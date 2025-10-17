const js = require("@eslint/js");
const globals = require("globals");
const pluginJest = require('eslint-plugin-jest');

module.exports = [
  {
    ...js.configs.recommended,
    plugins: { jest: pluginJest },
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      globals: {
        ...globals.node,...pluginJest.environments.globals.globals
      },
      ecmaVersion: 12,
      sourceType: "module",
    },
    
    ignores: [
      "**/node_modules/",
      "**/coverage/",
      "**/dist/",
    ],
    rules: {
      ...js.configs.recommended.rules,
      "no-console": "off",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "eqeqeq": ["error", "always"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-with": "error",
      "curly": ["error", "all"],
      "indent": ["error", 2],
      "quotes": ["error", "single", { avoidEscape: true }],
      "semi": ["error", "always"],
      "comma-dangle": ["error", "never"],
      "no-trailing-spaces": "error",
      "eol-last": ["error", "always"],
      "prefer-const": "error",
      "no-var": "error",
      "prefer-template": "error",
      "arrow-spacing": "error"
    }
  }
];