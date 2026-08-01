// Copies the self-hosted TinyMCE runtime into public/ so the admin newsletter
// composer can load it via a plain <script src="/tinymce/tinymce.min.js">
// (the @tinymce/tinymce-react docs recommend this over bundling tinymce
// through webpack, which chokes on its dynamic skin/plugin loading).
import { cpSync, existsSync } from "node:fs";
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
