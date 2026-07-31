const crypto = require("node:crypto");

const APP_ID = "1239370548302204";
const STATUS_ORIGIN = "https://legal.oneflow.cz";
const BODY_LIMIT = 64 * 1024;
const MAX_REQUEST_AGE_SECONDS = 30 * 24 * 60 * 60;

const base64UrlDecode = (input) => {
  const standard = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (standard.length % 4)) % 4);
  return Buffer.from(standard + padding, "base64");
};

const base64UrlEncode = (input) => Buffer.from(input).toString("base64url");

const parseSignedRequest = (signedRequest, appSecret, now = Date.now()) => {
  if (!appSecret) return { ok: false, error: "service_unavailable", status: 503 };
  if (typeof signedRequest !== "string") return { ok: false, error: "malformed_signed_request", status: 400 };
  const parts = signedRequest.split(".");
  if (parts.length !== 2 || parts.some((part) => !part)) {
    return { ok: false, error: "malformed_signed_request", status: 400 };
  }

  let payload;
  let actualSignature;
  try {
    payload = JSON.parse(base64UrlDecode(parts[1]).toString("utf8"));
    actualSignature = base64UrlDecode(parts[0]);
  } catch {
    return { ok: false, error: "invalid_signed_request", status: 400 };
  }

  if (payload.algorithm !== "HMAC-SHA256") return { ok: false, error: "unsupported_algorithm", status: 400 };
  const expectedSignature = crypto.createHmac("sha256", appSecret).update(parts[1]).digest();
  if (expectedSignature.length !== actualSignature.length || !crypto.timingSafeEqual(expectedSignature, actualSignature)) {
    return { ok: false, error: "invalid_signature", status: 400 };
  }

  const issuedAt = Number(payload.issued_at);
  const currentSeconds = Math.floor(now / 1000);
  if (!Number.isInteger(issuedAt) || issuedAt > currentSeconds + 300 || issuedAt < currentSeconds - MAX_REQUEST_AGE_SECONDS) {
    return { ok: false, error: "invalid_issued_at", status: 400 };
  }
  if (typeof payload.user_id !== "string" && typeof payload.user_id !== "number") {
    return { ok: false, error: "missing_user_id", status: 400 };
  }
  return { ok: true, data: payload, issuedAt };
};

const createConfirmationCode = (signedRequest, issuedAt, appSecret) => {
  const reference = crypto.createHash("sha256").update(signedRequest).digest("hex").slice(0, 16);
  const payload = base64UrlEncode(JSON.stringify({ version: 1, issuedAt, reference }));
  const signature = crypto.createHmac("sha256", appSecret).update(payload).digest("base64url").slice(0, 24);
  return `${payload}.${signature}`;
};

const safeSubjectReference = (userId, appSecret) => (
  crypto.createHmac("sha256", appSecret).update(String(userId)).digest("hex").slice(0, 16)
);

const getNtfyUrl = () => {
  if (!process.env.NTFY_TOPIC_URL) return null;
  try {
    const url = new URL(process.env.NTFY_TOPIC_URL);
    return url.protocol === "https:" && url.hostname === "ntfy.oneflow.cz" ? url.href : null;
  } catch {
    return null;
  }
};

const notifyNtfy = async (message) => {
  const ntfyUrl = getNtfyUrl();
  if (!ntfyUrl) return { sent: false, reason: "notification_unavailable" };
  try {
    const response = await fetch(ntfyUrl, {
      method: "POST",
      headers: {
        Title: "GDPR · Meta data deletion request",
        Priority: "high",
        Tags: "gdpr,meta,deletion"
      },
      body: message,
      signal: AbortSignal.timeout(4000)
    });
    return { sent: response.ok, status: response.status };
  } catch {
    return { sent: false, reason: "notification_failed" };
  }
};

const readBody = async (request) => {
  if (request.body !== undefined && request.body !== null) return request.body;
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    request.on("data", (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > BODY_LIMIT) {
        settled = true;
        reject(Object.assign(new Error("body_too_large"), { status: 413 }));
      }
      else chunks.push(Buffer.from(chunk));
    });
    request.on("end", () => {
      if (!settled) resolve(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", (error) => {
      if (!settled) reject(error);
    });
  });
};

const readSignedRequest = (body) => {
  if (typeof body === "string") return new URLSearchParams(body).get("signed_request");
  if (body && typeof body === "object") return body.signed_request;
  return null;
};

const sendJson = (response, status, payload) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
};

const handler = async (request, response) => {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "method_not_allowed", message: "POST only" });
  }

  let body;
  try {
    body = await readBody(request);
  } catch (error) {
    return sendJson(response, error.status || 400, { error: error.message || "invalid_body" });
  }

  const appSecret = process.env.META_APP_SECRET_PUBLISHER || "";
  const signedRequest = readSignedRequest(body);
  const parsed = parseSignedRequest(signedRequest, appSecret);
  if (!parsed.ok) return sendJson(response, parsed.status, { error: parsed.error });

  const confirmationCode = createConfirmationCode(signedRequest, parsed.issuedAt, appSecret);
  const statusUrl = `${STATUS_ORIGIN}/api/deletion-status/?code=${encodeURIComponent(confirmationCode)}`;
  const subjectReference = safeSubjectReference(parsed.data.user_id, appSecret);
  const message = [
    "Meta data deletion request received",
    `App: OneFlow Publisher (${APP_ID})`,
    `Meta user_id: ${parsed.data.user_id}`,
    `Subject reference: ${subjectReference}`,
    `Issued at: ${new Date(parsed.issuedAt * 1000).toISOString()}`,
    `Status URL: ${statusUrl}`,
    "Action: delete linked OneFlow data within the applicable deadline."
  ].join("\n");

  const notification = await notifyNtfy(message);
  if (!notification.sent) return sendJson(response, 503, { error: "notification_unavailable" });
  console.info(JSON.stringify({ event: "data_deletion_request", app_id: APP_ID, subject_ref: subjectReference }));
  return sendJson(response, 200, { url: statusUrl, confirmation_code: confirmationCode });
};

module.exports = handler;
module.exports._test = {
  createConfirmationCode,
  parseSignedRequest,
  readSignedRequest,
  safeSubjectReference
};
