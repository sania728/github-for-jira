import envVars from "../../config/env";

/**
 * An installation ID uniquely identifies an installation of a GitHub app across the (single) cloud instance
 * and (potentially many) GHE instances.
 */
export class InstallationId {
	readonly githubBaseUrl: string;
	readonly appId: number;
	readonly installationId: number;

	constructor(githubUrl: string, appId: number, installationId: number) {
		this.githubBaseUrl = githubUrl;
		this.appId = appId;
		this.installationId = installationId;
	}

	toString(): string {
		return `${this.githubBaseUrl}###${this.appId}###${this.installationId}`;
	}

	static fromString(appIdString: string): InstallationId {
		const regex = /^(.+)###([0-9]+)###([0-9]+)$/;
		const matches = regex.exec(appIdString);

		if (matches == null || matches.length < 3) {
			throw new Error(`could not extract AppId from string: ${appIdString}`);
		}

		const githubUrl = matches[1];
		const appId = matches[2];
		const installationId = matches[3];
		return new InstallationId(githubUrl, parseInt(appId), parseInt(installationId));
	}
}

export const getCloudInstallationId = (installationId: number): InstallationId => {
	return new InstallationId("https://api.github.com", parseInt(envVars.APP_ID), installationId);
}
