const crypto = require("node:crypto");

const MAX_CODE_AGE_SECONDS = 30 * 24 * 60 * 60;

const escapeHtml = (value) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const decodeConfirmationCode = (code, appSecret, now = Date.now()) => {
  if (!appSecret) return { state: "unavailable" };
  if (typeof code !== "string" || code.length < 30 || code.length > 220) return { state: "invalid" };
  const parts = code.split(".");
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) {
    return { state: "invalid" };
  }

  const expected = crypto.createHmac("sha256", appSecret).update(parts[0]).digest("base64url").slice(0, 24);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(parts[1]);
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return { state: "invalid" };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    return { state: "invalid" };
  }
  if (payload.version !== 1 || !Number.isInteger(payload.issuedAt) || !/^[a-f0-9]{16}$/.test(payload.reference || "")) {
    return { state: "invalid" };
  }

  const currentSeconds = Math.floor(now / 1000);
  if (payload.issuedAt > currentSeconds + 300) return { state: "invalid" };
  const ageSeconds = currentSeconds - payload.issuedAt;
  return { state: ageSeconds <= MAX_CODE_AGE_SECONDS ? "verified" : "elapsed", ...payload };
};

const statusCopy = (result, code) => {
  if (!code) {
    return {
      status: 200,
      label: "No confirmation code",
      title: "Request instructions",
      body: "No request is implied by this page. Use the Data Deletion Instructions to submit a request and obtain a signed confirmation code."
    };
  }
  if (result.state === "unavailable") {
    return {
      status: 503,
      label: "Service unavailable",
      title: "Verification is temporarily unavailable",
      body: "The signing service is not configured. No request status can be asserted until verification is restored."
    };
  }
  if (result.state === "invalid") {
    return {
      status: 400,
      label: "Invalid code",
      title: "This code is not verified",
      body: "The supplied value was not issued by the authenticated OneFlow callback. Check the complete URL or contact the data controller."
    };
  }

  const received = new Date(result.issuedAt * 1000).toISOString().slice(0, 10);
  const deadline = new Date((result.issuedAt + MAX_CODE_AGE_SECONDS) * 1000).toISOString().slice(0, 10);
  const elapsed = result.state === "elapsed";
  return {
    status: 200,
    label: elapsed ? "Processing window elapsed" : "Verified request",
    title: elapsed ? "Request requires a current status check" : "Request received and queued",
    body: elapsed
      ? `The signed request was received on ${received}. Its standard processing window ended on ${deadline}. Contact the data controller for the current result.`
      : `The signed request was received on ${received}. The standard processing deadline is ${deadline}.`,
    reference: result.reference
  };
};

const renderPage = (copy) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive,nosnippet">
  <title>Data deletion status · OneFlow Legal</title>
  <link rel="canonical" href="https://legal.oneflow.cz/api/deletion-status/">
  <link rel="icon" href="/_assets/icons/app-icon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/_assets/legal.css?v=20260731">
</head>
<body class="legal-page">
  <a class="skip-link" href="#main-content">Skip to status</a>
  <header class="site-header">
    <a class="wordmark" href="/" aria-label="OneFlow Legal home"><span class="brand-mark" aria-hidden="true"></span>OneFlow</a>
    <nav aria-label="Legal navigation"><a href="/">Legal archive</a><a href="https://oneflow.cz/">OneFlow.cz</a></nav>
  </header>
  <main class="container" id="main-content">
    <p class="brand">Meta deletion · App 1239370548302204</p>
    <h1>Data deletion status.</h1>
    <div class="status-panel" aria-live="polite">
      <span class="method-label">${escapeHtml(copy.label)}</span>
      <h2>${escapeHtml(copy.title)}</h2>
      <p>${escapeHtml(copy.body)}</p>
      ${copy.reference ? `<p>Request reference: <code>${escapeHtml(copy.reference)}</code></p>` : ""}
    </div>
    <section class="section">
      <h2><span class="num">Next step · EN</span>Need help?</h2>
      <div class="lang-block">
        <p>Contact <a href="mailto:dopita@oneflow.cz?subject=Data%20deletion%20status">dopita@oneflow.cz</a> and include the request reference or full confirmation URL.</p>
        <p><a href="/meta-platforms/oneflow-publisher-app-1239370548302204/user-data-deletion-instructions/">Open Data Deletion Instructions</a></p>
      </div>
    </section>
    <section class="section">
      <h2><span class="num">Další krok · CS</span>Potřebujete pomoc?</h2>
      <div class="lang-block">
        <p>Napište na <a href="mailto:dopita@oneflow.cz?subject=Stav%20zadosti%20o%20smazani">dopita@oneflow.cz</a> a uveďte referenci žádosti nebo celou potvrzovací URL.</p>
        <p><a href="/meta-platforms/oneflow-publisher-app-1239370548302204/user-data-deletion-instructions/#cs">Otevřít pokyny ke smazání dat</a></p>
      </div>
    </section>
  </main>
</body>
</html>`;

const handler = async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.statusCode = 405;
    response.setHeader("Allow", "GET, HEAD");
    return response.end();
  }
  const requestUrl = new URL(request.url, "https://legal.oneflow.cz");
  const code = requestUrl.searchParams.get("code") || "";
  const result = decodeConfirmationCode(code, process.env.META_APP_SECRET_PUBLISHER || "");
  const copy = statusCopy(result, code);
  const html = renderPage(copy);
  response.statusCode = copy.status;
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  return response.end(request.method === "HEAD" ? "" : html);
};

module.exports = handler;
module.exports._test = { decodeConfirmationCode, renderPage, statusCopy };
