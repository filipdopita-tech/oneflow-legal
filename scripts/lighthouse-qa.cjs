const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:4180").replace(/\/$/, "");
const outputDir = path.join(root, "audit", "lighthouse", process.env.QA_LABEL || "local");
const lighthouseCli = require.resolve("lighthouse/cli/index.js");
const categories = ["performance", "accessibility", "best-practices"];
const thresholds = { performance: 95, accessibility: 100, "best-practices": 100 };

const RUNS = [
  { name: "archive-mobile", route: "/", preset: null },
  { name: "archive-desktop", route: "/", preset: "desktop" },
  {
    name: "privacy-mobile",
    route: "/meta-platforms/oneflow-publisher-app-1239370548302204/data-controller-privacy-policy/",
    preset: null
  },
  {
    name: "privacy-desktop",
    route: "/meta-platforms/oneflow-publisher-app-1239370548302204/data-controller-privacy-policy/",
    preset: "desktop"
  }
];

const runLighthouse = ({ name, route, preset }) => {
  const outputPath = path.join(outputDir, `${name}.json`);
  const args = [
    lighthouseCli,
    `${baseUrl}${route}`,
    "--quiet",
    "--chrome-flags=--headless=new --disable-gpu",
    `--only-categories=${categories.join(",")}`,
    "--output=json",
    `--output-path=${outputPath}`
  ];
  if (preset) args.push(`--preset=${preset}`);
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${name}: Lighthouse failed\n${result.stderr || result.stdout}`);
  }
  return { name, report: JSON.parse(fs.readFileSync(outputPath, "utf8")) };
};

const score = ({ name, report }) => {
  const scores = Object.fromEntries(
    categories.map((category) => [category, Math.round(report.categories[category].score * 100)])
  );
  const misses = categories
    .filter((category) => scores[category] < thresholds[category])
    .map((category) => `${category} ${scores[category]} < ${thresholds[category]}`);
  if (misses.length) throw new Error(`${name}: ${misses.join(", ")}`);
  return `${name}: ${categories.map((category) => `${category}=${scores[category]}`).join(" ")}`;
};

fs.mkdirSync(outputDir, { recursive: true });
try {
  const summaries = RUNS.map(runLighthouse).map(score);
  process.stdout.write(`LIGHTHOUSE QA PASS\n${summaries.join("\n")}\n`);
} catch (error) {
  process.stderr.write(`LIGHTHOUSE QA FAIL\n${error.message}\n`);
  process.exit(1);
}
