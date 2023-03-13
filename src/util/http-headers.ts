const knownSafe = new Set([
	"a-im",
	"accept",
	"accept-ch",
	"accept-ch-lifetime",
	"accept-charset",
	"accept-datetime",
	"accept-encoding",
	"accept-language",
	"accept-patch",
	"accept-push-policy",
	"accept-ranges",
	"accept-signatures",
	"access-control-allow-credentials",
	"access-control-allow-headers",
	"access-control-allow-methods",
	"access-control-allow-origin",
	"access-control-expose-headers",
	"access-control-max-age",
	"access-control-request-headers",
	"access-control-request-method",
	"age",
	"allow",
	"also-control",
	"alt-svc",
	"alternate-recipient",
	"approved",
	"arc-message-signature",
	"arc-seal",
	"archive",
	"archived-at",
	"article-names",
	"article-updates",
	"auto-submitted",
	"autoforwarded",
	"autosubmitted",
	"base",
	"bcc",
	"body",
	"cache-control",
	"cancel-key",
	"cancel-lock",
	"cc",
	"clear-site-data",
	"comments",
	"connection",
	"content-alternative",
	"content-base",
	"content-description",
	"content-disposition",
	"content-dpr",
	"content-duration",
	"content-encoding",
	"content-features",
	"content-id",
	"content-identifier",
	"content-language",
	"content-length",
	"content-location",
	"content-md5",
	"content-range",
	"content-return",
	"content-security-policy",
	"content-security-policy-report-only",
	"content-transfer-encoding",
	"content-translation-type",
	"content-type",
	"control",
	"conversion",
	"conversion-with-loss",
	"cross-origin-embedder-policy",
	"cross-origin-opener-policy",
	"date",
	"date-received",
	"deferred-delivery",
	"delivery-date",
	"delta-base",
	"device-memory",
	"discarded-x400-ipms-extensions",
	"discarded-x400-mts-extensions",
	"disclose-recipients",
	"disposition-notification-options",
	"disposition-notification-to",
	"distribution",
	"dkim-signature",
	"dl-expansion-history",
	"dnt",
	"downgraded-bcc",
	"downgraded-cc",
	"downgraded-disposition-notification-to",
	"downgraded-final-recipient",
	"downgraded-from",
	"downgraded-in-reply-to",
	"downgraded-mail-from",
	"downgraded-message-id",
	"downgraded-original-recipient",
	"downgraded-rcpt-to",
	"downgraded-references",
	"downgraded-reply-to",
	"downgraded-resent-bcc",
	"downgraded-resent-cc",
	"downgraded-resent-from",
	"downgraded-resent-reply-to",
	"downgraded-resent-sender",
	"downgraded-resent-to",
	"downgraded-return-path",
	"downgraded-sender",
	"downgraded-to",
	"downlink",
	"dpr",
	"early-data",
	"ect",
	"encoding",
	"encrypted",
	"etag",
	"expect",
	"expect-ct",
	"expires",
	"expiry-date",
	"feature-policy",
	"followup-to",
	"forwarded",
	"from",
	"front-end-https",
	"generate-delivery-report",
	"host",
	"http2-settings",
	"if-match",
	"if-modified-since",
	"if-none-match",
	"if-range",
	"if-unmodified-since",
	"im",
	"importance",
	"in-reply-to",
	"incomplete-copy",
	"injection-date",
	"injection-info",
	"keep-alive",
	"keywords",
	"language",
	"large-allocation",
	"last-event-id",
	"last-modified",
	"latest-delivery-time",
	"lines",
	"link",
	"list-archive",
	"list-help",
	"list-id",
	"list-owner",
	"list-post",
	"list-subscribe",
	"list-unsubscribe",
	"list-unsubscribe-post",
	"location",
	"max-forwards",
	"message-context",
	"message-id",
	"message-type",
	"mime-version",
	"mmhs-exempted-address",
	"mmhs-handling-instructions",
	"mmhs-message-instructions",
	"mmhs-subject-indicator-codes",
	"nel",
	"origin",
	"origin-isolation",
	"p3p",
	"permissions-policy",
	"ping-from",
	"ping-to",
	"pragma",
	"prefer",
	"preference-applied",
	"proxy-connection",
	"public-key-pins",
	"public-key-pins-report-only",
	"push-policy",
	"range",
	"referer",
	"referrer-policy",
	"refresh",
	"report-to",
	"retry-after",
	"rtt",
	"save-data",
	"sec-fetch-dest",
	"sec-fetch-mode",
	"sec-fetch-sites",
	"sec-fetch-user",
	"sec-websocket-accept",
	"sec-websocket-extensions",
	"sec-websocket-key",
	"sec-websocket-protocol",
	"sec-websocket-version",
	"server",
	"server-timing",
	"service-worker-allowed",
	"signature",
	"signed-headers",
	"sourcemap",
	"status",
	"strict-transport-security",
	"te",
	"timing-allow-origin",
	"tk",
	"trailer",
	"transfer-encoding",
	"upgrade",
	"upgrade-insecure-requests",
	"user-agent",
	"vary",
	"via",
	"viewport-width",
	"warning",
	"width",
	"x-att-deviceid",
	"x-content-duration",
	"x-content-security-policy",
	"x-content-type-options",
	"x-correlation-id",
	"x-csrf-token",
	"x-dns-prefetch-control",
	"x-download-options",
	"x-firefox-spdy",
	"x-forwarded-for",
	"x-forwarded-host",
	"x-forwarded-proto",
	"x-frame-options",
	"x-http-method-override",
	"x-permitted-cross-domain-policies",
	"x-pingback",
	"x-powered-by",
	"x-redirect-by",
	"x-redirect-by: polylang",
	"x-request-id",
	"x-request-id x-correlation-id",
	"x-requested-with",
	"x-robots-tag",
	"x-ua-compatible",
	"x-uidh",
	"x-wap-profile",
	"x-webkit-csp",
	"x-xss-protection"
]);

// Not used in the code but leaving here for complete picture
// Also, we will need this list in the future for BTF customers (UI) when we will decide if the provided HTTP header
// can be used
// const knownSensitive = new Set([
// 	"arc-authentication-results",
// 	"authentication-results",
// 	"authorization",
// 	"mmhs-extended-authorisation-info",
// 	"proxy-authenticate",
// 	"proxy-authorization",
// 	"www-authenticate",
//
// 	"cookie",
// 	"cookie2",
// 	"set-cookie",
// 	"set-cookie2",
// ]);

const knownGitHubSafe = new Set([
	"x-github-request-id",
	"x-ratelimit-limit",
	"x-ratelimit-remaining",
	"x-ratelimit-reset",
	"x-oauth-scopes",
	"x-accepted-oauth-scopes",
	"x-github-delivery",
	"x-github-event",
	"x-github-hook-id",
	"x-ratelimit-used",
	"x-github-api-version-selected",
	"x-github-media-type",
	"x-ratelimit-resource"
]);

export const canLogHeader = (httpHeader: string) => {
	const sanitisedHeader = httpHeader.trim().toLowerCase();
	return knownSafe.has(sanitisedHeader) || knownGitHubSafe.has(sanitisedHeader);
};

