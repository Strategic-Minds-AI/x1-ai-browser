import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const packageJson = JSON.parse(read("package.json"));
const manifest = JSON.parse(read("public/manifest.json"));
const html = read("index.html");
const readme = read("README.md");
const env = read(".env.example");

assert.equal(packageJson.name, "x1-ai-browser");
assert.equal(manifest.short_name, "X1 Browser");
for (const text of [html, readme, env]) {
  assert.match(text, /X1 AI Browser/);
  assert.match(text, /Strategic Minds AI/);
}
assert.match(readme, /Strategic-Minds-AI\/x1-ai-browser/);
assert.doesNotMatch(html, /Xtreme Cloud Browser|BrowserForge/);
console.log("Strategic Minds AI branding contract: PASS");
