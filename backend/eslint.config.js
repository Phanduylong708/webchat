// eslint.config.js
import js from "@eslint/js";
import globals from "globals";

export default [
  // 1) Ignore trước
  {
    ignores: ["node_modules/**", "dist/**", ".env"],
  },

  // 2) Base rule set cho JS (flat config: đưa thẳng vào mảng, KHÔNG dùng "extends")
  js.configs.recommended,

  // 3) Tuỳ biến cho file .js
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      // thêm rule của bạn ở đây nếu cần
      // "no-unused-vars": "warn",
      eqeqeq: "error",
    },
  },
];
