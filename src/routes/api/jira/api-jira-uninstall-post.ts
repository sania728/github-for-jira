import { Request, Response } from "express";
import { Installation } from "models/installation";
import { JiraClient } from "models/jira-client";
import { JiraEventsUninstallPost } from "routes/jira/events/jira-events-uninstall-post";

type ResponseType =  Response<
	{
		message: string
	},
	JiraJwtVerifiedLocals
>;
export const ApiJiraUninstallPost = async (request: Request, response: ResponseType): Promise<void> => {
	response.locals.installation = await Installation.findOne({
		where: { clientKey: request.params.clientKey }
	});

	if (!response.locals.installation) {
		response.sendStatus(404);
		return;
	}
	const jiraClient = await JiraClient.getNewClient(
		response.locals.installation,
		request.log
	);
	const checkAuthorization = request.body.force !== "true";

	if (checkAuthorization && (await jiraClient.isAuthorized())) {
		response
			.status(400)
			.json({
				message: "Refusing to uninstall authorized Jira installation"
			});
		return;
	}
	request.log.info(
		`Forcing uninstall for ${response.locals.installation.clientKey}`
	);
	await JiraEventsUninstallPost(request, response);
};
