import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "node_modules/**", ".local-db/**", "public/sw.js", "playwright-report/**", "test-results/**", "next-env.d.ts"],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      // Pages-Router rule; plain <a> is correct for file downloads from route handlers in the App Router
      "@next/next/no-html-link-for-pages": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];

export default config;
