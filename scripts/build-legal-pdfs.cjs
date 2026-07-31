const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");
const documents = require("./pdf-manifest.cjs");

const root = path.join(__dirname, "..");
const baseUrl = process.env.BASE_URL || "http://127.0.0.1:4180";
const parsedBaseUrl = new URL(baseUrl);
const allowedHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const outputDir = path.join(root, "downloads");
const fontDir = path.join(root, "artwork", "pdf-fonts");

if (parsedBaseUrl.protocol !== "http:" || !allowedHosts.has(parsedBaseUrl.hostname)) {
  throw new Error(`PDF build refuses remote BASE_URL: ${baseUrl}`);
}

const fontFace = (family, file, weight) => {
  const base64 = fs.readFileSync(path.join(fontDir, file)).toString("base64");
  return `@font-face{font-family:"${family}";src:url(data:font/ttf;base64,${base64}) format("truetype");font-style:normal;font-weight:${weight};}`;
};

const fontCss = [
  fontFace("OneFlow PDF Inter Tight", "inter-tight-400.ttf", 400),
  fontFace("OneFlow PDF Inter Tight", "inter-tight-600.ttf", 600),
  fontFace("OneFlow PDF Fraunces", "fraunces-400.ttf", 400),
  fontFace("OneFlow PDF Fraunces", "fraunces-500.ttf", 500),
  '@media print{body.legal-page{font-family:"OneFlow PDF Inter Tight",sans-serif}.container h1,.container h2{font-family:"OneFlow PDF Fraunces",serif}.document-actions{display:none!important}}'
].join("");

const buildDocument = async (page, document) => {
  const url = new URL(document.route, baseUrl).href;
  const response = await page.goto(url, { waitUntil: "networkidle" });
  if (!response?.ok()) throw new Error(`${document.route}: HTTP ${response?.status() || "none"}`);
  await page.emulateMedia({ media: "print", colorScheme: "light", reducedMotion: "reduce" });
  await page.addStyleTag({ content: fontCss });
  await page.evaluate(() => document.fonts.ready);
  const output = path.join(outputDir, document.file);
  await page.pdf({
    path: output,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    tagged: true,
    outline: true
  });
  const bytes = fs.readFileSync(output);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  return `${document.file} bytes=${bytes.length} sha256=${sha256}`;
};

const run = async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    const page = await browser.newPage();
    for (const document of documents) results.push(await buildDocument(page, document));
  } finally {
    await browser.close();
  }
  process.stdout.write(`PDF BUILD PASS documents=${results.length}\n${results.join("\n")}\n`);
};

run().catch((error) => {
  process.stderr.write(`PDF BUILD FAIL\n${error.stack || error}\n`);
  process.exit(1);
});
