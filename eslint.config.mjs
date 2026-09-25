import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier";
import globals from "globals";
import codekraft from "./eslint-rules/index.js";

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      ".pg/**",
      "coverage/**",
      "playwright-report/**",
      "drizzle/migrations/**",
      "next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    plugins: { "@next/next": nextPlugin, "jsx-a11y": jsxA11y, codekraft },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...jsxA11y.configs.recommended.rules,
      "codekraft/no-edge-runtime": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/modules/{finance,payments,orders,invoices}/**/*.ts"],
    rules: { "codekraft/no-float-money": "error" },
  },
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: { "codekraft/no-hardcoded-colors": "error" },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: { sourceType: "commonjs", globals: { ...globals.node } },
  },
  {
    files: ["eslint-rules/**/*.js", "scripts/**/*.ts", "tests/**/*.ts", "tests/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  prettier,
);
