const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const callbackHandler = require("../api/data-deletion-callback");
const statusHandler = require("../api/deletion-status");

const SECRET = "local-verifier-secret";
const USER_ID = "998877665544";

const encode = (value) => Buffer.from(value).toString("base64url");

const createSignedRequest = ({
  secret = SECRET,
  userId = USER_ID,
  issuedAt = Math.floor(Date.now() / 1000),
  algorithm = "HMAC-SHA256"
} = {}) => {
  const payload = encode(JSON.stringify({
    algorithm,
    issued_at: issuedAt,
    user_id: userId
  }));
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${signature}.${payload}`;
};

const createResponse = () => {
  const headers = new Map();
  return {
    body: "",
    headers,
    statusCode: 200,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), String(value));
    },
    end(value = "") {
      this.body = String(value);
    }
  };
};

const invokeCallback = async ({
  method = "POST",
  signedRequest = createSignedRequest(),
  host = "legal.oneflow.cz"
} = {}) => {
  const request = {
    method,
    headers: { host },
    body: signedRequest === null
      ? ""
      : new URLSearchParams({ signed_request: signedRequest }).toString()
  };
  const response = createResponse();
  await callbackHandler(request, response);
  return response;
};

const invokeStatus = async ({ method = "GET", code = "" } = {}) => {
  const request = {
    method,
    url: `/api/deletion-status/${code ? `?code=${encodeURIComponent(code)}` : ""}`
  };
  const response = createResponse();
  await statusHandler(request, response);
  return response;
};

const withEnvironment = async (values, run) => {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test("callback verifies Meta signature, notifies once, and returns a fixed-origin code", async () => {
  await withEnvironment({
    META_APP_SECRET_PUBLISHER: SECRET,
    NTFY_TOPIC_URL: "https://ntfy.oneflow.cz/oneflow-private"
  }, async () => {
    const fetchCalls = [];
    const originalFetch = global.fetch;
    const originalInfo = console.info;
    const logs = [];
    global.fetch = async (...args) => {
      fetchCalls.push(args);
      return { ok: true, status: 200 };
    };
    console.info = (line) => logs.push(line);
    try {
      const response = await invokeCallback({ host: "attacker.invalid" });
      const payload = JSON.parse(response.body);

      assert.equal(response.statusCode, 200);
      assert.match(payload.url, /^https:\/\/legal\.oneflow\.cz\/api\/deletion-status\/\?code=/);
      assert.equal(payload.confirmation_code, new URL(payload.url).searchParams.get("code"));
      assert.equal(fetchCalls.length, 1);
      assert.equal(fetchCalls[0][0], "https://ntfy.oneflow.cz/oneflow-private");
      assert.equal(fetchCalls[0][1].method, "POST");
      assert.match(fetchCalls[0][1].body, new RegExp(`Meta user_id: ${USER_ID}`));
      assert.equal(logs.length, 1);
      assert.doesNotMatch(logs[0], new RegExp(USER_ID));

      const status = await invokeStatus({ code: payload.confirmation_code });
      assert.equal(status.statusCode, 200);
      assert.match(status.body, /Verified request/);
      assert.match(status.body, /Request received and queued/);
      assert.match(status.body, /Request reference:/);
    } finally {
      global.fetch = originalFetch;
      console.info = originalInfo;
    }
  });
});

test("callback fails closed before any notification when the app secret is missing", async () => {
  await withEnvironment({
    META_APP_SECRET_PUBLISHER: undefined,
    NTFY_TOPIC_URL: "https://ntfy.oneflow.cz/oneflow-private"
  }, async () => {
    const originalFetch = global.fetch;
    let called = false;
    global.fetch = async () => {
      called = true;
      return { ok: true, status: 200 };
    };
    try {
      const response = await invokeCallback();
      assert.equal(response.statusCode, 503);
      assert.deepEqual(JSON.parse(response.body), { error: "service_unavailable" });
      assert.equal(called, false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test("callback rejects invalid signatures, unsupported methods, and unavailable notifications", async () => {
  await withEnvironment({
    META_APP_SECRET_PUBLISHER: SECRET,
    NTFY_TOPIC_URL: "https://example.com/not-allowed"
  }, async () => {
    const invalid = await invokeCallback({ signedRequest: createSignedRequest({ secret: "wrong" }) });
    assert.equal(invalid.statusCode, 400);
    assert.equal(JSON.parse(invalid.body).error, "invalid_signature");

    const unavailable = await invokeCallback();
    assert.equal(unavailable.statusCode, 503);
    assert.equal(JSON.parse(unavailable.body).error, "notification_unavailable");

    const get = await invokeCallback({ method: "GET" });
    assert.equal(get.statusCode, 405);
    assert.equal(get.headers.get("allow"), "POST");
  });
});

test("confirmation codes are deterministic and expire into an explicit review state", () => {
  const signedRequest = createSignedRequest();
  const issuedAt = Math.floor(Date.now() / 1000);
  const first = callbackHandler._test.createConfirmationCode(signedRequest, issuedAt, SECRET);
  const second = callbackHandler._test.createConfirmationCode(signedRequest, issuedAt, SECRET);
  assert.equal(first, second);

  const elapsed = statusHandler._test.decodeConfirmationCode(
    first,
    SECRET,
    (issuedAt + (31 * 24 * 60 * 60)) * 1000
  );
  assert.equal(elapsed.state, "elapsed");
  const copy = statusHandler._test.statusCopy(elapsed, first);
  assert.equal(copy.status, 200);
  assert.match(copy.title, /current status check/);
  assert.doesNotMatch(copy.body, /completed/i);
});

test("status endpoint never presents arbitrary values as received requests", async () => {
  await withEnvironment({ META_APP_SECRET_PUBLISHER: SECRET }, async () => {
    const invalid = await invokeStatus({ code: "made-up-confirmation-code-value" });
    assert.equal(invalid.statusCode, 400);
    assert.match(invalid.body, /This code is not verified/);
    assert.doesNotMatch(invalid.body, /Request received and queued/);

    const empty = await invokeStatus();
    assert.equal(empty.statusCode, 200);
    assert.match(empty.body, /No request is implied by this page/);
  });
});

test("status verification fails closed without the app secret and supports HEAD", async () => {
  const code = callbackHandler._test.createConfirmationCode(
    createSignedRequest(),
    Math.floor(Date.now() / 1000),
    SECRET
  );
  await withEnvironment({ META_APP_SECRET_PUBLISHER: undefined }, async () => {
    const unavailable = await invokeStatus({ code });
    assert.equal(unavailable.statusCode, 503);
    assert.match(unavailable.body, /Verification is temporarily unavailable/);

    const head = await invokeStatus({ method: "HEAD" });
    assert.equal(head.statusCode, 200);
    assert.equal(head.body, "");
  });
});
