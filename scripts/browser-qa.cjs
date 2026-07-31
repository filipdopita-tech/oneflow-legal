const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

const root = path.join(__dirname, "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:4180").replace(/\/$/, "");
const auditRoot = path.join(root, "audit", "browser", process.env.QA_LABEL || "local");
const failures = [];

const ROUTES = [
  "/",
  "/sk/",
  "/de/",
  "/meta-platforms/oneflow-publisher-app-1239370548302204/data-controller-privacy-policy/",
  "/meta-platforms/oneflow-publisher-app-1239370548302204/terms-of-service-end-user-agreement/",
  "/meta-platforms/oneflow-publisher-app-1239370548302204/user-data-deletion-instructions/",
  "/meta-platforms/oneflowapp-app-1587515299033044/user-data-deletion-instructions/",
  "/sk/meta-platforms/oneflow-publisher-app-1239370548302204/data-controller-privacy-policy/",
  "/sk/meta-platforms/oneflow-publisher-app-1239370548302204/terms-of-service-end-user-agreement/",
  "/sk/meta-platforms/oneflow-publisher-app-1239370548302204/user-data-deletion-instructions/",
  "/de/meta-platforms/oneflow-publisher-app-1239370548302204/data-controller-privacy-policy/",
  "/de/meta-platforms/oneflow-publisher-app-1239370548302204/terms-of-service-end-user-agreement/",
  "/de/meta-platforms/oneflow-publisher-app-1239370548302204/user-data-deletion-instructions/",
  "/system/",
  "/404.html"
];

const PROFILES = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 }
];

const CAPTURE_ROUTES = new Map([
  ["/", "archive"],
  ["/meta-platforms/oneflow-publisher-app-1239370548302204/data-controller-privacy-policy/", "privacy"],
  ["/meta-platforms/oneflow-publisher-app-1239370548302204/user-data-deletion-instructions/", "deletion"],
  ["/meta-platforms/oneflow-publisher-app-1239370548302204/terms-of-service-end-user-agreement/", "terms"],
  ["/system/", "system"],
  ["/404.html", "404"]
]);

const fail = (profile, route, message) => failures.push(`${profile} ${route}: ${message}`);

const checkPage = async (page, profile, route) => {
  const browserErrors = [];
  const badResponses = [];
  page.on("pageerror", (error) => browserErrors.push(`pageerror ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console ${message.text()}`);
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === new URL(baseUrl).origin && response.status() >= 400) {
      badResponses.push(`${response.status()} ${url.pathname}`);
    }
  });

  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  if (!response || response.status() >= 400) fail(profile.name, route, `navigation ${response?.status() || "none"}`);
  if (browserErrors.length) fail(profile.name, route, browserErrors.join("; "));
  if (badResponses.length) fail(profile.name, route, `bad resources ${badResponses.join(", ")}`);

  const shape = await page.evaluate(() => ({
    h1: document.querySelectorAll("h1").length,
    main: document.querySelectorAll("main").length,
    title: document.title,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    lang: document.documentElement.lang,
    bodyFont: getComputedStyle(document.body).fontFamily
  }));
  if (shape.h1 !== 1 || shape.main !== 1) fail(profile.name, route, `shape h1=${shape.h1} main=${shape.main}`);
  if (!shape.title || !shape.lang) fail(profile.name, route, "missing title or language");
  if (shape.overflow > 1) fail(profile.name, route, `horizontal overflow ${shape.overflow}px`);
  if (!shape.bodyFont.includes("Inter Tight")) fail(profile.name, route, `brand font not applied: ${shape.bodyFont}`);

  const axe = await new AxeBuilder({ page }).analyze();
  if (axe.violations.length) {
    const summary = axe.violations.map((violation) => `${violation.id}(${violation.nodes.length})`).join(", ");
    fail(profile.name, route, `axe ${summary}`);
  }

  const screenshotName = CAPTURE_ROUTES.get(route);
  if (screenshotName) {
    const directory = path.join(auditRoot, profile.name);
    fs.mkdirSync(directory, { recursive: true });
    await page.screenshot({
      path: path.join(directory, `${screenshotName}.png`),
      fullPage: true
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(directory, `${screenshotName}-fold.png`),
      fullPage: false
    });
  }
};

const checkKeyboard = async (page, profile) => {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  const firstFocus = await page.evaluate(() => ({
    className: document.activeElement?.className || "",
    text: document.activeElement?.textContent?.trim() || ""
  }));
  if (!String(firstFocus.className).includes("skip-link")) fail(profile.name, "/", "skip link is not first focus");
  await page.keyboard.press("Enter");
  const target = await page.evaluate(() => document.activeElement?.id || location.hash);
  if (!String(target).includes("main-content")) fail(profile.name, "/", "skip link does not move to main");
};

const run = async () => {
  fs.mkdirSync(auditRoot, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const profile of PROFILES) {
      const context = await browser.newContext({
        viewport: { width: profile.width, height: profile.height },
        reducedMotion: "reduce",
        colorScheme: "light"
      });
      for (const route of ROUTES) {
        const page = await context.newPage();
        await checkPage(page, profile, route);
        await page.close();
      }
      const keyboardPage = await context.newPage();
      await checkKeyboard(keyboardPage, profile);
      await keyboardPage.close();
      await context.close();
    }
  } finally {
    await browser.close();
  }
};

run()
  .then(() => {
    if (failures.length) {
      process.stderr.write(`BROWSER QA FAIL (${failures.length})\n${failures.map((item) => `- ${item}`).join("\n")}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`BROWSER QA PASS routes=${ROUTES.length} viewports=${PROFILES.length} axe=0 overflow=0\n`);
  })
  .catch((error) => {
    process.stderr.write(`BROWSER QA ERROR\n${error.stack || error}\n`);
    process.exitCode = 1;
  });
