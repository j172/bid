import { createRequire } from "node:module";
import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

// eslint-config-next 預設把 settings.react.version 設為 "detect"，這會讓
// eslint-plugin-react（目前最新的 7.37.5，由 eslint-config-next 16.3.0 內部帶入）
// 呼叫已在 ESLint 10 移除的舊版 API context.getFilename()，導致整個 lint
// 直接拋錯中斷（而非規則層級的錯誤）。上游尚未釋出相容版本，故在此明確指定
// React 版本（改讀 package.json 實際安裝版本，避免寫死造成日後失準），繞開
// "detect" 觸發的自動偵測路徑，不需關閉任何規則。
const require = createRequire(import.meta.url);
const reactVersion = require("react/package.json").version;

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    settings: {
      react: {
        version: reactVersion,
      },
    },
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
  {
    files: ["next.config.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  globalIgnores([
    ".next/**",
    ".claude/**",
    "node_modules/**",
    "uploads/**",
    "public/tinymce/**",
  ]),
]);