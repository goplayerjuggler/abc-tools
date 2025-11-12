const { getContour, decodeChar, compare } = require("../../src/index.js");

describe("swingTransform", () => {
	describe("Basic", () => {
		test("triplets", () => {
			const abc = `X:1
L:1/8
M:2/8
K:G major
(3CDE`;

			const obj = getContour(abc, { withSwingTransform: true });
			expect(obj.durations).toBeUndefined();
			expect(obj.sortKey.length).toBe(3);
		});
		const twoNotes = `X:1
L:1/8
M:2/8
K:G major
AB`;
		test("basic conversion: AB⇒A2B", () => {
			const obj = getContour(twoNotes, { withSwingTransform: true });
			expect(obj.durations).toBeUndefined();
			expect(obj.sortKey.length).toBe(3);

			const decoded = Array.from(obj.sortKey).map((c) => decodeChar(c));

			expect(decoded[0].isHeld).toBe(false);
			expect(decoded[1].isHeld).toBe(true);
			expect(decoded[2].isHeld).toBe(false);

			expect(decoded[0].position).toBe(decoded[1].position);
			expect(decoded[2].position).toBeGreaterThan(decoded[1].position);
		});

		test("broken: A>B⇒A2B", () => {
			const abc = `X:1
L:1/8
M:2/8
K:G major
A>B`;
			const obj = getContour(abc, { withSwingTransform: true });
			const twoNotesContour = getContour(twoNotes, {
				withSwingTransform: true,
			});
			expect(compare(obj, twoNotesContour)).toBe(0);
		});
		test("reverse broken: A<B⇒AB2", () => {
			const abc = `X:1
L:1/8
M:2/8
K:G major
A<B`;
			const ab2 = `X:1
L:1/8
M:3/8
K:G major
AB2`;
			const obj = getContour(abc, { withSwingTransform: true });
			const ab2Contour = getContour(ab2);
			expect(compare(obj, ab2Contour)).toBe(0);
		});
		test("held notes: A3B⇒A3-A2B", () => {
			const abc = `X:1
L:1/8
M:4/8
K:G major
A3B`;
			const ab2 = `X:1
L:1/8
M:3/8
K:G major
A3-|A2B|`;
			const obj = getContour(abc, { withSwingTransform: true });
			const ab2Contour = getContour(ab2, { maxNbBars: 2 });
			expect(compare(obj, ab2Contour)).toBe(0);
		});
	});
});
