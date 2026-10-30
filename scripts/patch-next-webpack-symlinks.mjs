import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const nextPackagePath = require.resolve("next/package.json");
const nextPackage = JSON.parse(readFileSync(nextPackagePath, "utf8"));

if (nextPackage.version !== "16.4.3") {
  throw new Error(
    `The Webpack symlink patch is verified for Next.js 16.4.3, not ${nextPackage.version}. Re-evaluate the patch when upgrading Next.js.`,
  );
}

const webpackPath = join(dirname(nextPackagePath), "dist", "compiled", "webpack", "bundle5.js");
const bundle = readFileSync(webpackPath, "utf8");
const patches = [
  {
    name: "absolute symlink targets",
    original: "const q=L.toString();P(null,join(v,dirname(v,I),q))",
    replacement:
      "const q=L.toString();const absolute=q.startsWith(\"/\")||q.charCodeAt(0)===92||q.length>=3&&q.charCodeAt(1)===58&&(q.charCodeAt(2)===47||q.charCodeAt(2)===92);P(null,absolute?q:join(v,dirname(v,I),q))",
  },
  {
    name: "missing snapshot entries",
    original: 'const finalize=(P,R)=>{const $=P==="ignore"?R:{...P,...R};',
    replacement: 'const finalize=(P,R)=>{const $=R===null||P==="ignore"?R:{...P,...R};',
  },
];

let patchedBundle = bundle;
for (const { name, original, replacement } of patches) {
  const occurrences = patchedBundle.split(original).length - 1;
  const alreadyPatched = patchedBundle.split(replacement).length - 1;
  if (occurrences === 0 && alreadyPatched === 1) {
    continue;
  }
  if (occurrences === 1 && alreadyPatched === 0) {
    patchedBundle = patchedBundle.replace(original, replacement);
    continue;
  }
  throw new Error(
    `Could not apply the Webpack ${name} patch: expected one matching bundle fragment, found ${occurrences} unpatched and ${alreadyPatched} patched.`,
  );
}

if (patchedBundle !== bundle) {
  writeFileSync(webpackPath, patchedBundle);
  console.log("Patched Next.js Webpack absolute symlink snapshot handling");
} else {
  console.log("Next.js Webpack symlink snapshot patch is already applied");
}
