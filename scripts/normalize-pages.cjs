const fs = require("node:fs");
const path = require("node:path");
const pdfDocuments = require("./pdf-manifest.cjs");

const root = path.join(__dirname, "..");
const pdfBySource = new Map(pdfDocuments.map((document) => [document.source, document.file]));
const pages = [
  "index.html",
  "de/index.html",
  "sk/index.html",
  "meta-platforms/oneflow-publisher-app-1239370548302204/data-controller-privacy-policy/index.html",
  "meta-platforms/oneflow-publisher-app-1239370548302204/terms-of-service-end-user-agreement/index.html",
  "meta-platforms/oneflow-publisher-app-1239370548302204/user-data-deletion-instructions/index.html",
  "meta-platforms/oneflowapp-app-1587515299033044/user-data-deletion-instructions/index.html",
  "de/meta-platforms/oneflow-publisher-app-1239370548302204/data-controller-privacy-policy/index.html",
  "de/meta-platforms/oneflow-publisher-app-1239370548302204/terms-of-service-end-user-agreement/index.html",
  "de/meta-platforms/oneflow-publisher-app-1239370548302204/user-data-deletion-instructions/index.html",
  "sk/meta-platforms/oneflow-publisher-app-1239370548302204/data-controller-privacy-policy/index.html",
  "sk/meta-platforms/oneflow-publisher-app-1239370548302204/terms-of-service-end-user-agreement/index.html",
  "sk/meta-platforms/oneflow-publisher-app-1239370548302204/user-data-deletion-instructions/index.html"
];

const siteHeader = `<a class="skip-link" href="#main-content">Skip to document</a>
<header class="site-header">
  <a class="wordmark" href="/" aria-label="OneFlow Legal home"><span class="brand-mark" aria-hidden="true"></span>OneFlow</a>
  <nav aria-label="Legal navigation">
    <a href="/system/">System</a>
    <a href="https://oneflow.cz/">OneFlow.cz</a>
  </nav>
</header>`;

const normalize = (html, pdfFile) => {
  let output = html
    .replace(/<!-- INJECTED: SEO\/Schema\/OG \(2026-04-28\) -->[\s\S]*?<!-- END INJECTED -->\s*/g, "")
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/g, "")
    .replace(/<style>[\s\S]*?<\/style>\s*/g, "")
    .replace(/^.*fonts\.googleapis\.com.*\n?/gm, "")
    .replace(/^.*fonts\.gstatic\.com.*\n?/gm, "")
    .replace(/\sstyle="[^"]*"/g, "")
    .replaceAll("—", " · ")
    .replaceAll("–", "-")
    .replaceAll("%E2%80%94", "%C2%B7")
    .replaceAll("📧 ", "")
    .replace(/<table(?![^>]*\btabindex=)/g, '<table tabindex="0"');

  if (!output.includes("/_assets/legal.css")) {
    output = output.replace("</head>", '<link rel="stylesheet" href="/_assets/legal.css?v=20260731">\n</head>');
  }
  if (!output.includes('name="robots"')) {
    output = output.replace(
      /(<meta name="viewport"[^>]*>)/,
      '$1\n<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">'
    );
  }
  if (!output.includes("class=\"legal-page\"")) {
    output = output.replace("<body>", `<body class="legal-page">\n${siteHeader}`);
  }
  output = output.replace('<div class="container">', '<main class="container" id="main-content">');
  output = output.replace(/<\/div>\s*<\/body>/, "</main>\n</body>");
  if (pdfFile && !output.includes('class="document-actions"')) {
    const action = `<div class="document-actions"><a href="/downloads/${pdfFile}" download>Download PDF · A4</a></div>`;
    output = output.replace(/(<main class="container" id="main-content">[\s\S]*?<\/header>)/, `$1\n${action}`);
  }
  return output;
};

for (const relativeFile of pages) {
  const file = path.join(root, relativeFile);
  const before = fs.readFileSync(file, "utf8");
  const after = normalize(before, pdfBySource.get(relativeFile));
  fs.writeFileSync(file, after);
  process.stdout.write(`NORMALIZE PASS  ${relativeFile}\n`);
}
