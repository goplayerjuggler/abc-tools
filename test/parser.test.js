const { getTunes } = require("../src/parse/parser");

describe("getTunes", () => {
	test("extracts a single ABC tune", () => {
		const input = `X: 1
T: Simple Tune
K: C
CDEF|`;

		const result = getTunes(input);

		expect(result).toHaveLength(1);
		expect(result[0]).toContain("X: 1");
		expect(result[0]).toContain("T: Simple Tune");
	});

	test("extracts multiple ABC tunes separated by empty lines", () => {
		const input = `X: 1
T: First Tune
K: C
CDEF|

X: 2
T: Second Tune
K: G
GABc|`;

		const result = getTunes(input);

		expect(result).toHaveLength(2);
		expect(result[0]).toContain("First Tune");
		expect(result[1]).toContain("Second Tune");
	});

	test("extracts tune at the end of string without trailing empty line", () => {
		const input = `X: 1
T: Only Tune
K: D
DEFG|`;

		const result = getTunes(input);

		expect(result).toHaveLength(1);
		expect(result[0]).toContain("Only Tune");
	});

	test("handles tunes with varying whitespace in X: header", () => {
		const input = `X:1
T: No Space
K: C
CDEF|

X:  99
T: Extra Space
K: G
GABc|`;

		const result = getTunes(input);

		expect(result).toHaveLength(2);
		expect(result[0]).toContain("No Space");
		expect(result[1]).toContain("Extra Space");
	});

	test("ignores comments before first tune", () => {
		const input = `% This is a comment
% Another comment

X: 1
T: Real Tune
K: C
CDEF|`;

		const result = getTunes(input);

		expect(result).toHaveLength(1);
		expect(result[0]).not.toContain("This is a comment");
		expect(result[0]).toContain("Real Tune");
	});

	test("returns empty array for string with no ABC tunes", () => {
		const input = `Just some random text
No ABC notation here
Nothing to see`;

		const result = getTunes(input);

		expect(result).toHaveLength(0);
	});

	test("returns empty array for empty string", () => {
		const result = getTunes("");

		expect(result).toHaveLength(0);
	});

	test("throws TypeError for non-string input", () => {
		expect(() => getTunes(null)).toThrow(TypeError);
		expect(() => getTunes(undefined)).toThrow(TypeError);
		expect(() => getTunes(123)).toThrow(TypeError);
		expect(() => getTunes({})).toThrow(TypeError);
	});

	test("handles tunes with multiple empty lines between them", () => {
		const input = `X: 1
T: First
K: C
CDEF|


X: 2
T: Second
K: G
GABc|`;

		const result = getTunes(input);

		expect(result).toHaveLength(2);
	});

	test("preserves complete tune content including all metadata", () => {
		const input = `X: 1
T: Complete Tune
R: Reel
M: 4/4
L: 1/8
K: D
DEFG ABAG|`;

		const result = getTunes(input);

		expect(result[0]).toContain("R: Reel");
		expect(result[0]).toContain("M: 4/4");
		expect(result[0]).toContain("L: 1/8");
		expect(result[0]).toContain("DEFG ABAG|");
	});
});
