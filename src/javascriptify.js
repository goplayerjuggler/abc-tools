/**
 * Converts a JavaScript value to a string representation using JavaScript syntax.
 * Uses template literals for multiline strings and avoids quotes on property names where possible.
 * Object properties with values that are falsey or empty arrays are omitted.
 *
 * @param {*} value - The value to convert to JavaScript syntax
 * @param {number} indent - Current indentation level (for internal use)
 * @returns {string} JavaScript code representation of the value
 */
function javascriptify(value, indent = 0) {
	const indentStr = "  ".repeat(indent);
	const nextIndentStr = "  ".repeat(indent + 1);

	// Handle null and undefined
	if (value === null) {
		return "null";
	}
	if (value === undefined) {
		return "undefined";
	}

	// Handle primitives
	if (typeof value === "number") {
		return String(value);
	}
	if (typeof value === "boolean") {
		return String(value);
	}

	// Handle strings
	if (typeof value === "string") {
		// Check if string contains newlines
		if (value.includes("\n")) {
			// Escape backslashes, backticks, and template literal interpolations
			const escaped = value
				.replace(/\\/g, "\\\\")
				.replace(/`/g, "\\`")
				.replace(/\$/g, "\\$");
			return `\`${escaped}\``;
		}
		return JSON.stringify(value);
	}

	// Handle arrays
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return "[]";
		}

		const items = value
			.map((item) => nextIndentStr + javascriptify(item, indent + 1))
			.join(",\n");

		return `[\n${items}\n${indentStr}]`;
	}

	// Handle objects
	if (typeof value === "object") {
		// Filter out falsey values and empty arrays
		const keys = Object.keys(value).filter((k) => {
			const val = value[k];
			// Omit all falsey values (including false, but keep 0)
			if (val === 0) {
				return true;
			}
			//if (val === null || val === undefined || val === "") return false;
			if (!val) {
				return false;
			}
			// Omit empty arrays
			if (Array.isArray(val) && val.length === 0) {
				return false;
			}
			return true;
		});

		if (keys.length === 0) {
			return "{}";
		}

		const properties = keys
			.map((key) => {
				const propValue = javascriptify(value[key], indent + 1);
				// Check if key is a valid identifier (can be unquoted)
				const validIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
				const keyStr = validIdentifier ? key : JSON.stringify(key);
				return `${nextIndentStr}${keyStr}: ${propValue}`;
			})
			.join(",\n");

		return `{\n${properties}\n${indentStr}}`;
	}

	// Fallback for functions and other types
	return String(value);
}

module.exports = javascriptify;
