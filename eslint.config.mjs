import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
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