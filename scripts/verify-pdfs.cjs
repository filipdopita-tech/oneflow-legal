const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const documents = require("./pdf-manifest.cjs");

const root = path.join(__dirname, "..");
const outputDir = path.join(root, "downloads");
const previewDir = path.join(root, "audit", "pdf");
const failures = [];
const results = [];

const fail = (file, message) => failures.push(`${file}: ${message}`);

const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
};

const compact = (value) => value
  .normalize("NFKD")
  .replace(/\p{M}/gu, "")
  .replace(/[^\p{L}\p{N}]+/gu, "")
  .toLowerCase();

const extractPdf = (file) => {
  const code = [
    "import json, sys",
    "from pypdf import PdfReader",
    "reader = PdfReader(sys.argv[1])",
    "pages = [(page.extract_text() or '').strip() for page in reader.pages]",
    "print(json.dumps({'pages': len(pages), 'lengths': [len(page) for page in pages], 'text': '\\n'.join(pages)}, ensure_ascii=False))"
  ].join("; ");
  return JSON.parse(run(process.env.PYTHON || "python3", ["-c", code, file]));
};

const renderPreview = (file, name, page, suffix) => {
  const prefix = path.join(previewDir, `${name}-${suffix}`);
  run(process.env.PDFTOPPM || "pdftoppm", [
    "-f", String(page),
    "-l", String(page),
    "-singlefile",
    "-png",
    "-r", "96",
    file,
    prefix
  ]);
};

const verifyDocument = (document) => {
  const file = path.join(outputDir, document.file);
  if (!fs.existsSync(file)) {
    fail(document.file, "missing output");
    return;
  }
  const bytes = fs.readFileSync(file);
  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) fail(document.file, "invalid PDF header");
  if (bytes.length < 40_000 || bytes.length > 2_000_000) fail(document.file, `unexpected size ${bytes.length}`);

  const info = run(process.env.PDFINFO || "pdfinfo", [file]);
  if (!/^Tagged:\s+yes$/m.test(info)) fail(document.file, "not tagged");
  if (!/^JavaScript:\s+no$/m.test(info)) fail(document.file, "contains JavaScript");
  if (!/^Encrypted:\s+no$/m.test(info)) fail(document.file, "is encrypted");
  if (!/^Suspects:\s+no$/m.test(info)) fail(document.file, "tag structure is suspect");
  if (!/^Page size:.*\(A4\)$/m.test(info)) fail(document.file, "not A4");

  const extracted = extractPdf(file);
  if (extracted.pages < 2 || extracted.pages > 30) fail(document.file, `unexpected pages ${extracted.pages}`);
  if (Math.min(...extracted.lengths) < 100) fail(document.file, `near-empty page ${Math.min(...extracted.lengths)} chars`);
  if (extracted.text.includes("\uFFFD")) fail(document.file, "replacement glyph in extracted text");
  const compactText = compact(extracted.text);
  for (const token of document.tokens) {
    if (!compactText.includes(compact(token))) fail(document.file, `missing text token ${token}`);
  }

  const slug = document.file.replace(/\.pdf$/, "");
  renderPreview(file, slug, 1, "first");
  renderPreview(file, slug, extracted.pages, "last");
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  results.push(`${document.file} pages=${extracted.pages} bytes=${bytes.length} sha256=${sha256}`);
};

fs.mkdirSync(previewDir, { recursive: true });
for (const document of documents) {
  try {
    verifyDocument(document);
  } catch (error) {
    fail(document.file, error.message);
  }
}

if (failures.length) {
  process.stderr.write(`PDF VERIFY FAIL (${failures.length})\n${failures.map((item) => `- ${item}`).join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`PDF VERIFY PASS documents=${results.length} rendered=${results.length * 2}\n${results.join("\n")}\n`);
