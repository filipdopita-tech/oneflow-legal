const fs = require("node:fs");
const path = require("node:path");
const pdfDocuments = require("./pdf-manifest.cjs");

const root = path.join(__dirname, "..");
const failures = [];

const ROUTES = [
  ["index.html", 3],
  ["sk/index.html", 3],
  ["de/index.html", 3],
  ["meta-platforms/oneflow-publisher-app-1239370548302204/data-controller-privacy-policy/index.html", 14],
  ["meta-platforms/oneflow-publisher-app-1239370548302204/terms-of-service-end-user-agreement/index.html", 16],
  ["meta-platforms/oneflow-publisher-app-1239370548302204/user-data-deletion-instructions/index.html", 8],
  ["meta-platforms/oneflowapp-app-1587515299033044/user-data-deletion-instructions/index.html", 8],
  ["sk/meta-platforms/oneflow-publisher-app-1239370548302204/data-controller-privacy-policy/index.html", 7],
  ["sk/meta-platforms/oneflow-publisher-app-1239370548302204/terms-of-service-end-user-agreement/index.html", 10],
  ["sk/meta-platforms/oneflow-publisher-app-1239370548302204/user-data-deletion-instructions/index.html", 4],
  ["de/meta-platforms/oneflow-publisher-app-1239370548302204/data-controller-privacy-policy/index.html", 7],
  ["de/meta-platforms/oneflow-publisher-app-1239370548302204/terms-of-service-end-user-agreement/index.html", 10],
  ["de/meta-platforms/oneflow-publisher-app-1239370548302204/user-data-deletion-instructions/index.html", 4],
  ["system/index.html", 6],
  ["404.html", 0]
];

const REQUIRED_FILES = [
  ...ROUTES.map(([file]) => file),
  "_assets/legal.css",
  "_assets/system.css",
  "_assets/fonts/fraunces.woff2",
  "_assets/fonts/fraunces-italic.woff2",
  "_assets/fonts/inter-tight.woff2",
  "_assets/fonts/geist-mono.woff2",
  "_assets/icons/app-icon.svg",
  "api/data-deletion-callback.js",
  "api/deletion-status.js",
  "LEGAL_REVIEW.md",
  "RECOVERED-DEPLOYMENT.sha1",
  "robots.txt",
  "sitemap.xml",
  "vercel.json",
  ...pdfDocuments.map((document) => `downloads/${document.file}`)
];

const fail = (message) => failures.push(message);
const read = (relativeFile) => fs.readFileSync(path.join(root, relativeFile), "utf8");
const count = (text, pattern) => [...text.matchAll(pattern)].length;

const listOwnedFiles = (directory = root) => {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", ".vercel", "audit", "node_modules"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute);
    const stats = fs.lstatSync(absolute);
    if (stats.isSymbolicLink()) fail(`${relative}: symlink is not deploy-safe`);
    else if (entry.isDirectory()) files.push(...listOwnedFiles(absolute));
    else if (entry.isFile()) files.push(relative);
    else fail(`${relative}: unsupported filesystem entry`);
  }
  return files;
};

const routeToFile = (urlPath, currentFile) => {
  const withoutQuery = urlPath.split(/[?#]/)[0];
  if (!withoutQuery) return currentFile;
  if (withoutQuery.startsWith("/api/")) return null;
  const relative = withoutQuery.startsWith("/")
    ? withoutQuery.slice(1)
    : path.relative(root, path.resolve(path.dirname(path.join(root, currentFile)), withoutQuery));
  if (!relative || relative.endsWith("/")) return path.join(relative, "index.html");
  if (path.extname(relative)) return relative;
  return path.join(relative, "index.html");
};

const checkDocumentShape = (relativeFile, expectedH2) => {
  const html = read(relativeFile);
  const h1Count = count(html, /<h1(?:\s|>)/g);
  const mainCount = count(html, /<main(?:\s|>)/g);
  const h2Count = count(html, /<h2(?:\s|>)/g);
  if (h1Count !== 1) fail(`${relativeFile}: expected one h1, found ${h1Count}`);
  if (mainCount !== 1) fail(`${relativeFile}: expected one main, found ${mainCount}`);
  if (h2Count !== expectedH2) fail(`${relativeFile}: expected ${expectedH2} h2, found ${h2Count}`);
  if (!/<html[^>]+lang="[^"]+"/.test(html)) fail(`${relativeFile}: missing html language`);
  if (!/<meta name="viewport"/.test(html)) fail(`${relativeFile}: missing viewport`);
  if (!/<meta name="robots" content="[^"]*noindex/.test(html)) {
    fail(`${relativeFile}: missing explicit noindex contract`);
  }
  if (/<style(?:\s|>)/.test(html) || /\sstyle="/.test(html)) fail(`${relativeFile}: inline style found`);
  if (/<script(?:\s|>)/.test(html)) fail(`${relativeFile}: script found on static legal page`);
  if (/href="#"/.test(html)) fail(`${relativeFile}: dead href found`);
  if (/[–—]/.test(html)) fail(`${relativeFile}: forbidden dash character found`);
  if (/[\u{1F300}-\u{1FAFF}]/u.test(html)) fail(`${relativeFile}: emoji found outside design system`);

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) fail(`${relativeFile}: duplicate ids ${[...new Set(duplicates)].join(", ")}`);
  return html;
};

const checkReferences = (relativeFile, html) => {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
  for (const match of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const raw = match[1].replaceAll("&amp;", "&");
    if (/^(?:https?:|mailto:|tel:|data:)/.test(raw)) continue;
    if (raw.startsWith("#")) {
      if (!ids.has(raw.slice(1))) fail(`${relativeFile}: missing local anchor ${raw}`);
      continue;
    }
    const target = routeToFile(raw, relativeFile);
    if (target && !fs.existsSync(path.join(root, target))) fail(`${relativeFile}: missing local target ${raw}`);
    const fragment = raw.includes("#") ? raw.split("#")[1] : "";
    if (target && fragment && fs.existsSync(path.join(root, target))) {
      const targetHtml = read(target);
      if (!new RegExp(`\\sid="${fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(targetHtml)) {
        fail(`${relativeFile}: missing target anchor ${raw}`);
      }
    }
  }
  for (const tag of html.matchAll(/<a[^>]+target="_blank"[^>]*>/g)) {
    if (!/rel="[^"]*noopener/.test(tag[0])) fail(`${relativeFile}: target blank without noopener`);
  }
};

const checkCssReferences = (relativeFile) => {
  const css = read(relativeFile);
  for (const match of css.matchAll(/url\((['"]?)([^)'"]+)\1\)/g)) {
    const raw = match[2].split(/[?#]/)[0];
    if (/^(?:https?:|data:)/.test(raw)) continue;
    const target = raw.startsWith("/")
      ? path.join(root, raw.slice(1))
      : path.resolve(path.dirname(path.join(root, relativeFile)), raw);
    if (!fs.existsSync(target)) fail(`${relativeFile}: missing CSS asset ${raw}`);
  }
  if (/@import/.test(css)) fail(`${relativeFile}: CSS import is not allowed`);
  if (/Inter|Roboto|Arial|system-ui/.test(css) && !/Inter Tight/.test(css)) {
    fail(`${relativeFile}: unapproved default font found`);
  }
};

const checkContentInvariants = () => {
  const appId = "1239370548302204";
  const policy = read(ROUTES[3][0]);
  const terms = read(ROUTES[4][0]);
  const deletion = read(ROUTES[5][0]);
  const statusSource = read("api/deletion-status.js");
  if (!policy.includes(appId) || !policy.includes("OneFlow s.r.o.")) fail("privacy policy lost controller identity");
  if (!terms.includes(appId) || !terms.includes("Terms of Service")) fail("terms lost app identity");
  if (!deletion.includes("/api/deletion-status/?code=")) fail("deletion instructions lost canonical status route");
  if (/automated acknowledgement email|automatizovaný potvrzovací e-mail/.test(deletion)) {
    fail("deletion instructions assert a nonexistent automated email");
  }
  if (!statusSource.includes("This code is not verified")) fail("status endpoint lacks invalid-code state");
  if (!statusSource.includes("No request is implied by this page")) fail("status endpoint lacks empty-code disclaimer");
};

const checkVercelContract = () => {
  const config = JSON.parse(read("vercel.json"));
  const headers = config.headers.flatMap((entry) => entry.headers);
  const header = (key) => headers.find((item) => item.key === key)?.value || "";
  if (!header("X-Robots-Tag").includes("noindex")) fail("Vercel noindex header missing");
  if (!header("Content-Security-Policy").includes("script-src 'none'")) fail("strict script CSP missing");
  if (config.functions?.["api/data-deletion-callback.js"]?.maxDuration !== 10) {
    fail("callback function duration contract changed");
  }
  const expectedRedirects = [
    "/instagram-privacy.html",
    "/instagram-privacy/",
    "/instagram-terms.html",
    "/instagram-terms/",
    "/privacy/",
    "/terms/"
  ];
  const sources = new Set(config.redirects.map((item) => item.source));
  for (const source of expectedRedirects) if (!sources.has(source)) fail(`missing legacy redirect ${source}`);
};

const checkSecuritySource = () => {
  const callback = read("api/data-deletion-callback.js");
  const required = [
    'const STATUS_ORIGIN = "https://legal.oneflow.cz"',
    'payload.algorithm !== "HMAC-SHA256"',
    "crypto.timingSafeEqual",
    'url.hostname === "ntfy.oneflow.cz"',
    "notification_unavailable"
  ];
  for (const token of required) if (!callback.includes(token)) fail(`callback security invariant missing: ${token}`);
  if (/request\.headers|headers\.host/.test(callback)) fail("callback derives trust from request headers");
  if (/console\.log/.test(callback)) fail("callback contains debug logging");
  const infoLine = callback.split("\n").find((line) => line.includes("console.info")) || "";
  if (infoLine.includes("user_id") || infoLine.includes("confirmationCode")) fail("callback log exposes subject data");
};

const checkSourceHygiene = (files) => {
  const textFiles = files.filter((file) => /\.(?:c?js|css|html|json|md|txt|xml)$/.test(file));
  for (const file of textFiles) {
    const source = read(file);
    const unfinished = new RegExp(`\\b(?:${["TO", "DO"].join("")}|${["FIX", "ME"].join("")})\\b`);
    if (unfinished.test(source)) fail(`${file}: unfinished marker found`);
    if (/\r/.test(source)) fail(`${file}: CRLF found`);
    const lineCount = source.split("\n").length;
    if (/\.(?:c?js|css|html)$/.test(file) && lineCount > 800) fail(`${file}: exceeds 800 lines`);
  }
  const joined = textFiles.map((file) => read(file)).join("\n");
  if (/(?:ghp|github_pat|sk_live|sk_test)_[A-Za-z0-9_-]{16,}/.test(joined)) fail("secret-like token found");
};

for (const required of REQUIRED_FILES) {
  if (!fs.existsSync(path.join(root, required))) fail(`required file missing: ${required}`);
}

const ownedFiles = listOwnedFiles();
for (const [relativeFile, expectedH2] of ROUTES) {
  const html = checkDocumentShape(relativeFile, expectedH2);
  checkReferences(relativeFile, html);
}
checkCssReferences("_assets/legal.css");
checkCssReferences("_assets/system.css");
checkContentInvariants();
checkVercelContract();
checkSecuritySource();
checkSourceHygiene(ownedFiles);

const robots = read("robots.txt");
if (!/User-agent: \*\s+Allow: \//.test(robots)) fail("robots.txt must allow Meta compliance crawling");
const sitemap = read("sitemap.xml");
for (const [relativeFile] of ROUTES.slice(0, 13)) {
  const route = relativeFile === "index.html" ? "/" : `/${relativeFile.replace(/index\.html$/, "")}`;
  if (!sitemap.includes(`https://legal.oneflow.cz${route}`)) fail(`sitemap missing ${route}`);
}

if (failures.length) {
  process.stderr.write(`VERIFY FAIL (${failures.length})\n${failures.map((item) => `- ${item}`).join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`VERIFY PASS routes=${ROUTES.length} files=${ownedFiles.length} security=closed content=bounded\n`);
