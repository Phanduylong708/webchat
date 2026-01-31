// eslint.config.js
import js from "@eslint/js";
import globals from "globals";
import pluginN from "eslint-plugin-n";
export default [
  {
    ignores: ["node_modules/**", "dist/**", ".env"],
  },

  js.configs.recommended,
  pluginN.configs["flat/recommended"],

  {
    files: ["eslint.config.js"],
    rules: {
      "n/no-unpublished-import": "off",
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      eqeqeq: "error",
    },
  },
  {
    files: ["scripts/**/*.{js,mjs,cjs}"],
    rules: {
      "n/no-unpublished-import": "off",
    },
  },
];
