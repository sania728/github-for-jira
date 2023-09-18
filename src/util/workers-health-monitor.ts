import { stopHealthcheck } from "utils/healthcheck-stopper";
import Logger from "bunyan";
import cluster from "cluster";
import { exec } from "child_process";
import { logInfoSampled } from "utils/log-sampled";
import glob from "glob";
import fs from "fs";
import AWS from "aws-sdk";
import { v4 as UUID } from "uuid";
import { envVars } from "config/env";
import { GenerateOnceCoredumpGenerator } from "services/generate-once-coredump-generator";
import { GenerateOncePerNodeHeadumpGenerator } from "services/generate-once-per-node-headump-generator";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import oom from "node-oom-heapdump";

const SHUTDOWN_MSG = "shutdown";
const HEAPDUMP_ON_CRASH_MSG = "heapdump_on_crash";

const generateHeapdumpPathOnOom = (pid: string) => {
	return `/tmp/dump_heap_oom_${pid}`;
};

export const startMonitorOnWorker = (parentLogger: Logger, workerConfig: {
	iAmAliveInervalMsec: number,
	dumpIntervalMsec: number,
	lowHeapAvailPct: number,
}) => {
	const logger = parentLogger.child({ isWorker: true });
	logger.info({ workerConfig }, "worker config");

	const coreDumpGenerator = new GenerateOnceCoredumpGenerator({
		logger,
		lowHeapAvailPct: workerConfig.lowHeapAvailPct
	});

	let dumpsFlagValue = true; // to simplify testing, let's enable it by default; it will switch to false quickly

	// Not invoking inline because "maybeGenerateDump()" are synchronous calls, don't want to make it asynchronous just
	// because of the flag: much more difficult to test.
	const flagInterval = setInterval(async () => {
		dumpsFlagValue = await booleanFlag(BooleanFlags.GENERATE_CORE_HEAP_DUMPS_ON_LOW_MEM);
	}, 1000);

	const coredumpInterval = setInterval(() => {
		if (dumpsFlagValue) {
			coreDumpGenerator.maybeGenerateDump();
		}
	}, workerConfig.dumpIntervalMsec);

	const heapdumpGenerator = new GenerateOncePerNodeHeadumpGenerator({
		logger,
		lowHeapAvailPct: workerConfig.lowHeapAvailPct
	});

	const heapdumpInterval = setInterval(() => {
		if (dumpsFlagValue) {
			heapdumpGenerator.maybeGenerateDump();
		}
	}, workerConfig.dumpIntervalMsec);

	process.on("message", (msg: string) => {
		logger.info(`worker received a message: ${msg}`);
		if (msg === SHUTDOWN_MSG) {
			logger.warn("shutdown received, stop healthcheck");
			stopHealthcheck();
		}
		if (msg === HEAPDUMP_ON_CRASH_MSG) {
			if (dumpsFlagValue) {
				logger.warn("charging heapdump on crash");
				oom({
					path: generateHeapdumpPathOnOom(process.pid.toString())
				});
			}
		}
	});

	const workerPingingServerInterval = setInterval(() => {
		if (typeof process.send === "function") {
			logInfoSampled(logger, "startMonitorOnWorker.alive", "sending I'm alive", 100);
			process.send(`${process.pid}`);
		} else {
			logger.error("process.send is undefined in worker, shouldn't happen");
			clearInterval(workerPingingServerInterval);
		}
	}, workerConfig.iAmAliveInervalMsec);

	return [workerPingingServerInterval, coredumpInterval, heapdumpInterval, flagInterval];
};

const logRunningProcesses = (logger: Logger) => {
	exec("ps aux", (err, stdout) => {
		if (err) {
			logger.error({ err }, `exec error: ${err.toString()}`);
			return;
		}

		const outputLines = stdout.split("\n");
		outputLines.forEach((outputLine) => {
			logger.info("running process found: " + outputLine);
		});
	});
};

export const startMonitorOnMaster = (parentLogger: Logger, config: {
	pollIntervalMsecs: number,
	workerStartupTimeMsecs: number,
	workerUnresponsiveThresholdMsecs: number,
	numberOfWorkersThreshold: number,
}) => {
	const logger = parentLogger.child({ isWorker: false });
	logger.info(config, "master config");

	const registeredWorkers: Record<string, boolean> = { }; // pid => true
	const liveWorkers: Record<string, number> = { }; // pid => timestamp

	const registerNewWorkers = () => {
		logInfoSampled(logger, "monRegWorkers", `registering workers`, 100);

		for (const worker of Object.values(cluster.workers)) {
			if (worker) {
				const workerPid = worker.process.pid;
				if (!registeredWorkers[workerPid]) {
					logger.info(`registering a new worker with pid=${workerPid}`);
					registeredWorkers[workerPid] = true;
					worker.on("message", () => {
						logInfoSampled(logger, "workerIsAlive:" + workerPid.toString(), `received message from worker ${workerPid}, marking as live`, 100);
						liveWorkers[workerPid] = Date.now();
					});
					worker.on("exit", (code, signal) => {
						const maybeOomHeapdumpPath = generateHeapdumpPathOnOom(workerPid.toString()) + ".heapsnapshot";
						if (fs.existsSync(maybeOomHeapdumpPath)) {
							logger.info(`found ${maybeOomHeapdumpPath}, prepare for uploading`);
							fs.renameSync(maybeOomHeapdumpPath, maybeOomHeapdumpPath + ".ready");
						}
						if (signal) {
							logger.warn(`worker was killed by signal: ${signal}, code=${code}`);
						} else if (code !== 0) {
							logger.warn(`worker exited with error code: ${code}`);
						} else {
							logger.warn("worker exited with success code");
						}
					});
				}
			}
		}
	};

	let workersReadyAt: undefined | Date;
	const areWorkersReady = () => workersReadyAt && workersReadyAt.getTime() < Date.now();
	const maybeSetupWorkersReadyAt = () => {
		if (areWorkersReady()) {
			logInfoSampled(logger, "workersReadyNothingToDo", "all workers are considered ready, workersReadyAt", 100);
			return ;
		}

		logRunningProcesses(logger);

		if (!workersReadyAt) {
			if (Object.keys(registeredWorkers).length > config.numberOfWorkersThreshold) {
				workersReadyAt = new Date(Date.now() + config.workerStartupTimeMsecs);
				logger.info(`consider workers as ready after ${workersReadyAt.toString()}`);
			} else {
				logger.info("no enough workers");
			}
		} else {
			logger.info({
				workersReadyAt
			}, `workersReadyAt is defined, idling during ${config.workerStartupTimeMsecs} msecs`);
		}
	};

	// Given that heapdump eats a lot of mem and CPU, let's listen to only one worker. Otherwise, if 2 or more workers
	// crash, that would put the whole node under risk,
	let workerToReportOnCrashPid: string | undefined;
	const maybeChargeWorkerToGenerateHeapdumpOnCrash = () => {
		if (areWorkersReady() && !workerToReportOnCrashPid && Object.keys(registeredWorkers).length > 0) {
			const pids = Object.keys(registeredWorkers);
			workerToReportOnCrashPid = pids[Math.floor(Math.random() * pids.length)];
			const worker = cluster.workers[workerToReportOnCrashPid];
			if (!worker) {
				workerToReportOnCrashPid = undefined;
				return;
			}
			worker.send(HEAPDUMP_ON_CRASH_MSG);
		}
	};

	const maybeRemoveDeadWorkers = () => {
		if (areWorkersReady()) {
			logger.info(`removing dead workers`);
			const keysToKill: Array<string> = [];
			const now = Date.now();
			Object.keys(liveWorkers).forEach((key) => {
				if (now - liveWorkers[key] > config.workerUnresponsiveThresholdMsecs) {
					keysToKill.push(key);
				}
			});
			keysToKill.forEach((key) => {
				logger.info(`remove worker with pid=${key} from live workers`);
				delete liveWorkers[key];
				logRunningProcesses(logger);
			});
		} else {
			logger.warn("workers are not ready yet, skip removing logic");
		}
	};

	const maybeSendShutdownToAllWorkers = () => {
		const nLiveWorkers = Object.keys(liveWorkers).length;
		if (areWorkersReady() && (nLiveWorkers < config.numberOfWorkersThreshold)) {
			logger.info({
				nLiveWorkers
			}, `send shutdown signal to all workers`);
			for (const worker of Object.values(cluster.workers)) {
				worker?.send(SHUTDOWN_MSG);
			}
			logRunningProcesses(logger);
		} else {
			logInfoSampled(logger.child({
				areWorkersReady: areWorkersReady(),
				nLiveWorkers
			}), "notSendingSignal", "not sending shutdown signal", 100);
		}
	};

	const maybeUploadeDumpFiles = () => {
		const now = new Date(); // fix time early for testing, while timers are still frozen

		glob("/tmp/dump*.ready", (err: Error, dumpFiles: Array<string>) => {
			if (err) {
				logger.error("Cannot get dump files using glob");
				return;
			}
			dumpFiles.forEach((file) => {
				const fileSplit = file.split("/");
				const uploadId = UUID();
				const uploadLogger = logger.child({ uploadId });
				const uploadInProgressFile =  file + ".uploadinprogress";
				const key = `${fileSplit[fileSplit.length - 1]}_${now.toISOString().split(":").join("_").split(".").join("_")}`;
				fs.renameSync(file, uploadInProgressFile);
				uploadLogger.info(`start uploading ${uploadInProgressFile} with key ${key}`);

				const s3 = new AWS.S3();

				const uploadParams = {
					Bucket: envVars.S3_DUMPS_BUCKET_NAME,
					Key: `${envVars.S3_DUMPS_BUCKET_PATH}/${key}`,
					Body: fs.createReadStream(uploadInProgressFile),
					Region: envVars.S3_DUMPS_BUCKET_REGION
				};

				uploadLogger.info({ uploadParams }, "about to upload dump");

				s3.upload(uploadParams, (err, data) => {
					if (err) {
						uploadLogger.error({ err }, `cannot upload ${uploadInProgressFile}`);
					} else {
						uploadLogger.info({ data }, `file was successfully uploaded`);
					}
					fs.unlinkSync(uploadInProgressFile);
				});
			});
		});
	};

	return setInterval(() => {
		registerNewWorkers(); // must be called periodically to make sure we pick up new/respawned workers
		maybeSetupWorkersReadyAt();
		maybeChargeWorkerToGenerateHeapdumpOnCrash();
		maybeRemoveDeadWorkers();
		maybeSendShutdownToAllWorkers();
		maybeUploadeDumpFiles();
	}, config.pollIntervalMsecs);
};
