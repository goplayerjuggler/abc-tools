const js = require("@eslint/js");
const globals = require("globals");
const pluginJest = require("eslint-plugin-jest");

module.exports = [
	{
		...js.configs.recommended,
		plugins: { jest: pluginJest },
		languageOptions: {
			...js.configs.recommended.languageOptions,
			globals: {
				...globals.node,
				...pluginJest.environments.globals.globals,
			},
			ecmaVersion: 12,
			sourceType: "module",
		},

		ignores: ["**/node_modules/", "**/coverage/", "**/dist/"],
		rules: {
			...js.configs.recommended.rules,
			// "arrow-spacing": "error"
			curly: ["error", "all"],
			// "eol-last": ["error", "always"],
			eqeqeq: ["error", "always"],
			"no-console": "off",
			"no-eval": "error",
			"no-implied-eval": "error",
			// "no-trailing-spaces": "error",
			"no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
			"no-var": "error",
			"no-with": "error",
			"prefer-const": "error",
			// "prefer-template": "error",
			// "comma-dangle": ["error", "never"],
			// "indent": ["error", 2],
			// "quotes": ["error", "single", { avoidEscape: true }],
			// "semi": ["error", "always"],
		},
	},
];
