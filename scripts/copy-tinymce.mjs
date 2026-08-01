// Copies the self-hosted TinyMCE runtime into public/ so the admin newsletter
// composer can load it via a plain <script src="/tinymce/tinymce.min.js">
// (the @tinymce/tinymce-react docs recommend this over bundling tinymce
// through webpack, which chokes on its dynamic skin/plugin loading).
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "node_modules", "tinymce");
const destination = join(root, "public", "tinymce");

if (!existsSync(source)) {
  console.warn("tinymce package not found in node_modules — skipping copy to public/tinymce");
  process.exit(0);
}

cpSync(source, destination, { recursive: true });
console.log("Copied tinymce runtime to public/tinymce");

// TinyMCE's own npm package ships no language files at all — the zh-TW UI
// (menus/toolbar tooltips/dialogs) comes from tinymce-i18n instead, which
// redistributes Tiny's official packs versioned per TinyMCE major release.
// TinyMCE auto-loads `langs/{language}.js` relative to tinymceScriptSrc, so
// the file must land at public/tinymce/langs/zh-TW.js.
const langSource = join(root, "node_modules", "tinymce-i18n", "langs8", "zh-TW.js");
const langDestination = join(destination, "langs", "zh-TW.js");

if (!existsSync(langSource)) {
  console.warn("tinymce-i18n zh-TW language file not found — skipping zh-TW language copy");
} else {
  mkdirSync(dirname(langDestination), { recursive: true });
  cpSync(langSource, langDestination);
  console.log("Copied zh-TW language pack to public/tinymce/langs/zh-TW.js");
}
