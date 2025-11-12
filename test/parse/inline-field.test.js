const { parseAbc, Fraction } = require("../../src/index.js");

describe("Inline field barline enrichment", () => {
	describe("Meter changes", () => {
		test("should attach newMeter to barline when meter changes between bars", () => {
			const abc = `X:1
M:4/4
L:1/4
K:C
C4|[M:3/4]D3|]`;

			const result = parseAbc(abc);

			// Should have 2 bars
			expect(result.bars).toHaveLength(2);

			// Should have 2 barlines ( middle & end)
			expect(result.barLines).toHaveLength(2);

			// First barline should have the meter change
			expect(result.barLines[0].newMeter).toEqual([3, 4]);
			// expect(result.barLines[0].trimmed).toBe("|");

			// 2nd barline should not have a meter change
			expect(result.barLines[1].newMeter).toBeUndefined();
		});

		test("should handle meter change at start of tune", () => {
			const abc = `X:1
M:4/4
L:1/4
K:C
[M:3/4]C3|D3|]`;

			const result = parseAbc(abc);

			// Should have 2 bars
			expect(result.bars).toHaveLength(2);

			// Should have 3 barlines
			expect(result.barLines).toHaveLength(2);

			//  meter change
			expect(result.meter).toEqual([3, 4]);
			// 2nd & 3rd barline should not have a meter change
			expect(result.barLines[0].newMeter).toBeUndefined();
			expect(result.barLines[1].newMeter).toBeUndefined();
		});

		test("should handle C and C| meter notation", () => {
			const abc1 = `X:1
M:4/4
L:1/4
K:C
C4|[M:C]D4|]`;

			const result1 = parseAbc(abc1);
			expect(result1.barLines[0].newMeter).toEqual([4, 4]);

			// Should have 2 barlines
			expect(result1.barLines).toHaveLength(2);

			const abc2 = `X:1
M:4/4
L:1/4
K:C
C4|[M:C|]D2|]`;

			const result2 = parseAbc(abc2);

			// Should have 2 barlines
			expect(result2.barLines).toHaveLength(2);
			expect(result2.barLines[0].newMeter).toEqual([2, 2]);
		});
	});

	describe("Unit length changes", () => {
		test("should attach newUnitLength to barline when length changes", () => {
			const abc = `X:1
M:4/4
L:1/4
K:C
C4|[L:1/2]D2|]`;

			const result = parseAbc(abc);

			expect(result.barLines).toHaveLength(2);
			expect(result.barLines[0].newUnitLength).toEqual(new Fraction(1, 2));
		});

		test("should store unit length as Fraction object", () => {
			const abc = `X:1
M:4/4
L:1/4
K:C
C4|[L:1/8]D8|]`;

			const result = parseAbc(abc);

			const newLength = result.barLines[0].newUnitLength;
			expect(newLength).toBeInstanceOf(Fraction);
			expect(newLength.num).toBe(1);
			expect(newLength.den).toBe(8);
		});
	});

	describe("Key changes", () => {
		test("should attach newKey to barline when key changes", () => {
			const abc = `X:1
M:4/4
L:1/4
K:C
C4|[K:D]D4|]`;

			const result = parseAbc(abc);

			expect(result.barLines).toHaveLength(2);
			expect(result.barLines[0].newKey).toBe("D");
		});

		test("should handle key change mid-bar", () => {
			const abc = `X:1
M:4/4
L:1/4
K:C
C4|D2-[K:D]D2|]`;

			const result = parseAbc(abc);

			// The inline field should be in the bar
			const bar2 = result.bars[1];
			const inlineFieldToken = bar2.find((item) => item.isInlineField);
			expect(inlineFieldToken).toBeDefined();
			expect(inlineFieldToken.field).toBe("K");
			expect(inlineFieldToken.value).toBe("D");

			// And also attached to the preceding barline
			expect(result.barLines[0].newKey).toBe("D");
		});

		test("should handle full key signatures with mode", () => {
			const abc = `X:1
M:4/4
L:1/4
K:C
C4|[K:G mixo]D4|]`;

			const result = parseAbc(abc);

			expect(result.barLines[0].newKey).toBe("G mixo");
		});
	});

	describe("Multiple inline fields", () => {
		test("should attach multiple inline fields to same barline", () => {
			const abc = `X:1
M:4/4
L:1/4
K:C
C4|[M:3/4][L:1/8]D3|]`;

			const result = parseAbc(abc);

			expect(result.barLines).toHaveLength(2);

			// 1st barline should have both meter and length changes
			expect(result.barLines[0].newMeter).toEqual([3, 4]);
			expect(result.barLines[0].newUnitLength).toEqual(new Fraction(1, 8));
		});

		test("should attach meter, length, and key changes to same barline", () => {
			const abc = `X:1
M:4/4
L:1/4
K:C
C4|[K:D][M:3/4][L:1/8]D3|]`;

			const result = parseAbc(abc);

			expect(result.barLines).toHaveLength(2);

			const barline = result.barLines[0];
			expect(barline.newKey).toBe("D");
			expect(barline.newMeter).toEqual([3, 4]);
			expect(barline.newUnitLength).toEqual(new Fraction(1, 8));
		});
	});

	describe("Part markers", () => {
		test("should attach newPart to barline for P: field", () => {
			const abc = `X:1
M:4/4
L:1/4
K:C
C4|[P:B]D4|]`;

			const result = parseAbc(abc);

			expect(result.barLines).toHaveLength(2);
			expect(result.barLines[0].newPart).toBe("B");
		});
	});

	describe("Inline fields remain in bar array", () => {
		test("should keep inline field tokens in bar array", () => {
			const abc = `X:1
M:4/4
L:1/4
K:C
C4|[M:3/4]D3|]`;

			const result = parseAbc(abc);

			// Check that inline field is in bar
			const bar2 = result.bars[1];
			const inlineField = bar2.find((item) => item.isInlineField);
			expect(inlineField).toBeDefined();
			expect(inlineField.field).toBe("M");
			expect(inlineField.value).toBe("3/4");

			// And also attached to barline
			expect(result.barLines[0].newMeter).toEqual([3, 4]);
		});
	});

	describe("Edge cases", () => {
		test("should handle inline field immediately after initial barline", () => {
			const abc = `X:1
M:4/4
L:1/4
K:C
|[K:D]D4|E4|]`;

			const result = parseAbc(abc);

			// Should have initial barline with key change
			expect(result.barLines[0].newKey).toBe("D");
		});

		test("should handle multiple inline fields at tune start", () => {
			const abc = `X:1
M:4/4
L:1/4
K:C
[M:3/4][L:1/8]C6|D6|]`;

			const result = parseAbc(abc);

			expect(result.barLines).toHaveLength(2);
			expect(result.meter).toEqual([3, 4]);
			expect(result.unitLength).toEqual(new Fraction(1, 8));
		});

		test("should not affect barlines without inline fields", () => {
			const abc = `X:1
M:4/4
L:1/4
K:C
C4|D4|E4|]`;

			const result = parseAbc(abc);

			expect(result.barLines).toHaveLength(3);
			result.barLines.forEach((barline) => {
				expect(barline.newKey).toBeUndefined();
				expect(barline.newMeter).toBeUndefined();
				expect(barline.newUnitLength).toBeUndefined();
			});
		});

		test("should handle inline fields with spacing", () => {
			const abc = `X:1
M:4/4
L:1/4
K:C
C4|[K: D major]D4|]`;

			const result = parseAbc(abc);

			expect(result.barLines[0].newKey).toBe("D major");
		});
	});

	describe("Complex scenarios", () => {
		test("should handle inline fields with repeat notation", () => {
			const abc = `X:1
M:4/4
L:1/4
K:C
|:C4|[K:D]D4:|`;

			const result = parseAbc(abc);

			expect(result.barLines[1].newKey).toBe("D");
			expect(result.barLines[1].isRepeatR).toBeUndefined();
			expect(result.barLines[2].isRepeatL).toBe(true);
		});

		test("should handle inline fields in tune with variant endings", () => {
			const abc = `X:1
M:4/4
L:1/4
K:C
C4|[1[K:D]D4:|[2E4|]`;

			const result = parseAbc(abc);

			// Key change should be attached to barline before [1
			expect(result.barLines[0].newKey).toBe("D");
		});
	});
});

