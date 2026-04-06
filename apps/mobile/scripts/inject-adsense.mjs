/**
 * Post-export script: injects Google AdSense into dist/index.html.
 * Run after `npx expo export --platform web`.
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, "../dist/index.html");

const adsenseScript = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9336334259937355" crossorigin="anonymous"></script>`;

let html = readFileSync(htmlPath, "utf8");

if (html.includes("googlesyndication")) {
  console.log("AdSense already present in index.html");
} else {
  html = html.replace("</head>", `  ${adsenseScript}\n  </head>`);
  writeFileSync(htmlPath, html);
  console.log("Injected AdSense script into dist/index.html");
}
