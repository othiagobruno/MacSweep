// Renders assets/tray-icon.svg into the menu bar template PNGs (1x + 2x)
// using headless Chrome. Run: node scripts/gen-tray-icon.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const svg = fs.readFileSync(path.join(root, "assets/tray-icon.svg"), "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tray-icon-"));
const html = path.join(tmp, "icon.html");
fs.writeFileSync(
  html,
  `<html><body style="margin:0;background:transparent">${svg.replace("<svg ", '<svg style="display:block" ')}</body></html>`,
);

for (const [scale, name] of [[1, "trayTemplate.png"], [2, "trayTemplate@2x.png"]]) {
  execFileSync(chrome, [
    "--headless=new",
    "--hide-scrollbars",
    "--default-background-color=00000000",
    `--force-device-scale-factor=${scale}`,
    "--window-size=18,18",
    `--screenshot=${path.join(root, "assets", name)}`,
    `file://${html}`,
  ], { stdio: "ignore" });
  console.log("wrote assets/" + name);
}
