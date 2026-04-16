/**
 * Reads tournaments.yaml and writes src/lib/tournaments/schedule.json
 * Run automatically before dev/build via package.json scripts.
 */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const yamlPath = path.join(__dirname, "..", "tournaments.yaml");
const outPath = path.join(__dirname, "..", "src", "lib", "tournaments", "schedule.json");

const raw = fs.readFileSync(yamlPath, "utf-8");
const data = yaml.load(raw);

fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
console.log("✅ tournaments.yaml → schedule.json");
