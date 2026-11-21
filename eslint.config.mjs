import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/*.d.ts", "apps/web/public/**", "**/next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { process: "readonly", console: "readonly", Buffer: "readonly", URL: "readonly", setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly", TextEncoder: "readonly", TextDecoder: "readonly", crypto: "readonly", fetch: "readonly", Response: "readonly", Request: "readonly", Headers: "readonly", self: "readonly", window: "readonly", document: "readonly", chrome: "readonly", performance: "readonly", structuredClone: "readonly", atob: "readonly", btoa: "readonly" } },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "@typescript-eslint/no-require-imports": "off"
    }
  }
);
