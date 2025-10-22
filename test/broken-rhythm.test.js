const { parseABCWithBars } = require("../src/parse/parser.js");
const { Fraction } = require("../src/math.js");

describe("broken rhythms", () => {
	test("single dot dotted rhythm A>B", () => {
		const abc = "X:1\nL:1/8\nK:C\nA>B";
		const result = parseABCWithBars(abc);

		expect(result.bars).toHaveLength(1);
		const bar = result.bars[0];

		// Filter out non-note tokens
		const notes = bar.filter((item) => item.pitch);
		expect(notes).toHaveLength(2);

		// A should get 3/4 of the total (3/16), B should get 1/4 (1/16)
		// Total: 1/8 + 1/8 = 1/4
		// A: 1/4 * 3/4 = 3/16
		// B: 1/4 * 1/4 = 1/16
		expect(notes[0].pitch).toBe("A");
		expect(notes[0].duration.equals(new Fraction(3, 16))).toBe(true);

		expect(notes[1].pitch).toBe("B");
		expect(notes[1].duration.equals(new Fraction(1, 16))).toBe(true);
	});

	test("single dot reverse rhythm A<B", () => {
		const abc = "X:1\nL:1/8\nK:C\nA<B|\n";
		const result = parseABCWithBars(abc);

		expect(result.bars).toHaveLength(1);
		const bar = result.bars[0];

		const notes = bar.filter((item) => item.pitch);
		expect(notes).toHaveLength(2);

		// A should get 1/4 of the total (1/16), B should get 3/4 (3/16)
		expect(notes[0].pitch).toBe("A");
		expect(notes[0].duration.equals(new Fraction(1, 16))).toBe(true);

		expect(notes[1].pitch).toBe("B");
		expect(notes[1].duration.equals(new Fraction(3, 16))).toBe(true);
	});

	test("double dot rhythm A>>B", () => {
		const abc = "X:1\nL:1/8\nK:C\nA>>B|\n";
		const result = parseABCWithBars(abc);

		expect(result.bars).toHaveLength(1);
		const bar = result.bars[0];

		const notes = bar.filter((item) => item.pitch);
		expect(notes).toHaveLength(2);

		// Double dot: 7:1 ratio
		// Total: 1/4
		// A: 1/4 * 7/8 = 7/32
		// B: 1/4 * 1/8 = 1/32
		expect(notes[0].pitch).toBe("A");
		expect(notes[0].duration.equals(new Fraction(7, 32))).toBe(true);

		expect(notes[1].pitch).toBe("B");
		expect(notes[1].duration.equals(new Fraction(1, 32))).toBe(true);
	});

	test("triple dot rhythm A<<<B", () => {
		const abc = "X:1\nL:1/8\nK:C\nA<<<B|\n";
		const result = parseABCWithBars(abc);

		expect(result.bars).toHaveLength(1);
		const bar = result.bars[0];

		const notes = bar.filter((item) => item.pitch);
		expect(notes).toHaveLength(2);

		// Triple dot: 15:1 ratio
		// Total: 1/4
		// A: 1/4 * 1/16 = 1/64
		// B: 1/4 * 15/16 = 15/64
		expect(notes[0].pitch).toBe("A");
		expect(notes[0].duration.equals(new Fraction(1, 64))).toBe(true);

		expect(notes[1].pitch).toBe("B");
		expect(notes[1].duration.equals(new Fraction(15, 64))).toBe(true);
	});

	test("broken rhythm with different note durations - has no effect", () => {
		const abc = "X:1\nL:1/8\nK:C\nA2>B|\n";
		const result = parseABCWithBars(abc);

		expect(result.bars).toHaveLength(1);
		const bar = result.bars[0];

		const notes = bar.filter((item) => item.pitch);
		expect(notes).toHaveLength(2);

		// A2 = 1/4, B = 1/8
		// Total: 3/8
		// A: 3/8 * 3/4 = 9/32
		// B: 3/8 * 1/4 = 3/32
		expect(notes[0].pitch).toBe("A");
		expect(notes[0].duration.equals(new Fraction(1, 4))).toBe(true);

		expect(notes[1].pitch).toBe("B");
		expect(notes[1].duration.equals(new Fraction(1, 8))).toBe(true);
	});

	test("broken rhythm with whitespace", () => {
		const abc = "X:1\nL:1/8\nK:C\nA > B|\n";
		const result = parseABCWithBars(abc);

		expect(result.bars).toHaveLength(1);
		const bar = result.bars[0];

		const notes = bar.filter((item) => item.pitch);
		expect(notes).toHaveLength(2);

		expect(notes[0].pitch).toBe("A");
		expect(notes[0].duration.equals(new Fraction(3, 16))).toBe(true);

		expect(notes[1].pitch).toBe("B");
		expect(notes[1].duration.equals(new Fraction(1, 16))).toBe(true);
	});

	test("multiple broken rhythms in sequence", () => {
		const abc = "X:1\nL:1/8\nK:C\nA>B C<D|\n";
		const result = parseABCWithBars(abc);

		expect(result.bars).toHaveLength(1);
		const bar = result.bars[0];

		const notes = bar.filter((item) => item.pitch);
		expect(notes).toHaveLength(4);

		// A>B
		expect(notes[0].pitch).toBe("A");
		expect(notes[0].duration.equals(new Fraction(3, 16))).toBe(true);
		expect(notes[1].pitch).toBe("B");
		expect(notes[1].duration.equals(new Fraction(1, 16))).toBe(true);

		// C<D
		expect(notes[2].pitch).toBe("C");
		expect(notes[2].duration.equals(new Fraction(1, 16))).toBe(true);
		expect(notes[3].pitch).toBe("D");
		expect(notes[3].duration.equals(new Fraction(3, 16))).toBe(true);
	});

	test("broken rhythm marker is recorded in bar", () => {
		const abc = "X:1\nL:1/8\nK:C\nA>B|\n";
		const result = parseABCWithBars(abc);

		expect(result.bars).toHaveLength(1);
		const bar = result.bars[0];

		// Should have: note A, broken rhythm marker, note B
		const brokenRhythm = bar.find((item) => item.isBrokenRhythm);
		expect(brokenRhythm).toBeDefined();
		expect(brokenRhythm.direction).toBe(">");
		expect(brokenRhythm.dots).toBe(1);
	});
});
