const nextVitals = require("eslint-config-next/core-web-vitals");
const nextTs = require("eslint-config-next/typescript");

module.exports = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      "eslint.config.js",
      ".next/**",
      "out/**",
      "build/**",
      "public/wasm/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      "next-env.d.ts",
    ],
  },
];
