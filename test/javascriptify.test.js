const javascriptify = require("../src/javascriptify.js");
describe("javascriptify", () => {
	test("handles simple object with string properties", () => {
		const obj = { myProp: "foo" };
		const result = javascriptify(obj);
		expect(result).toBe('{\n  myProp: "foo"\n}');
	});

	test("handles multiline strings with template literals", () => {
		const obj = {
			bar: `
    multi-line content
...
    `,
		};
		const result = javascriptify(obj);
		expect(result).toContain("`");
		expect(result).toContain("multi-line content");
	});

	test("handles nested objects and arrays", () => {
		const obj = {
			myProp: "foo",
			bar: `
    multi-line content
...
    `,
			baz: [
				{
					myProp: "foo",
					bar: `
    multi-line content
...
    `,
				},
			],
		};
		const result = javascriptify(obj);
		expect(result).toContain('myProp: "foo"');
		expect(result).toContain("baz: [");
		expect(result).toContain("`");
	});

	test("handles primitives", () => {
		expect(javascriptify(42)).toBe("42");
		expect(javascriptify(true)).toBe("true");
		expect(javascriptify(false)).toBe("false");
		expect(javascriptify(null)).toBe("null");
		expect(javascriptify(undefined)).toBe("undefined");
	});

	test("handles empty objects and arrays", () => {
		expect(javascriptify({})).toBe("{}");
		expect(javascriptify([])).toBe("[]");
	});

	test("omits falsey values from objects", () => {
		const obj = {
			keep: "value",
			omitNull: null,
			omitUndefined: undefined,
			omitEmptyString: "",
			omitFalse: false,
			keepZero: 0,
		};
		const result = javascriptify(obj);
		expect(result).toContain("keep:");
		expect(result).toContain("keepZero:");
		expect(result).not.toContain("omitFalse:");
		expect(result).not.toContain("omitNull");
		expect(result).not.toContain("omitUndefined");
		expect(result).not.toContain("omitEmptyString");
	});

	test("omits empty arrays from objects", () => {
		const obj = {
			items: [1, 2, 3],
			emptyItems: [],
			name: "test",
		};
		const result = javascriptify(obj);
		expect(result).toContain("items:");
		expect(result).toContain("name:");
		expect(result).not.toContain("emptyItems");
	});

	test("quotes property names that are not valid identifiers", () => {
		const obj = { "my-prop": "value", 123: "number key" };
		const result = javascriptify(obj);
		expect(result).toContain('"my-prop"');
		expect(result).toContain('"123"');
	});

	test("does not quote valid identifier property names", () => {
		const obj = { validName: "value", _private: "test", $jQuery: "selector" };
		const result = javascriptify(obj);
		expect(result).toContain("validName:");
		expect(result).toContain("_private:");
		expect(result).toContain("$jQuery:");
		expect(result).not.toContain('"validName"');
		expect(result).not.toContain('"_private"');
		expect(result).not.toContain('"$jQuery"');
	});

	test("handles nested arrays", () => {
		const arr = [1, [2, 3], [4, [5, 6]]];
		const result = javascriptify(arr);
		expect(result).toContain("[");
		expect(result).toContain("2");
		expect(result).toContain("6");
	});

	test("handles strings with special characters", () => {
		const obj = { text: 'She said "hello"' };
		const result = javascriptify(obj);
		expect(result).toContain('text: "She said \\"hello\\""');
	});

	test("preserves indentation for deeply nested structures", () => {
		const obj = {
			level1: {
				level2: {
					level3: "deep",
				},
			},
		};
		const result = javascriptify(obj);
		const lines = result.split("\n");
		expect(lines.some((line) => line.startsWith("      "))).toBe(true);
	});

	test("escapes backticks in multiline strings", () => {
		const obj = {
			code: `const msg = \`hello\`;
console.log(msg);`,
		};
		const result = javascriptify(obj);
		expect(result).toContain("\\`");
		expect(result).toContain("code: `");
	});

	test("escapes backslashes in multiline strings", () => {
		const obj = {
			path: `C:\\Users\\name
D:\\Projects`,
		};
		const result = javascriptify(obj);
		expect(result).toContain("\\\\");
	});

	test("escapes dollar signs in multiline strings to prevent interpolation", () => {
		const obj = {
			text: `Price is $50
Total: ${100}`,
		};
		const result = javascriptify(obj);
		expect(result).toContain("\\$");
	});

	test("handles combination of special characters in multiline strings", () => {
		const obj = {
			complex: `Here's a backtick: \`
And a backslash: \\
And a dollar: $
And interpolation: \${var}`,
		};
		const result = javascriptify(obj);
		// It’s safe to use eval here so we disable ESLint’s rule
		// eslint-disable-next-line no-eval
		const evaluated = eval(`(${result})`);
		expect(evaluated.complex).toBe(obj.complex);
	});
});
