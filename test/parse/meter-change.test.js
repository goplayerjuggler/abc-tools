const { getBarInfo } = require("../../src/parse/getBarInfo.js");
const { parseAbc } = require("../../src/parse/parser.js");

describe("getBarInfo - meter and unit length changes", () => {
	describe("Meter changes", () => {
		test.skip("simple meter change from 4/4 to 3/4", () => {
			const abc = `X:1
L:1/4
M:4/4
K:C
C4|[M:3/4]D3|E3|]`;

			const parsed = parseAbc(abc);
			const result = getBarInfo(parsed.bars, parsed.barLines, parsed.meter);
			const { barLines } = result;

			// Bar 0: C4 (complete 4/4 bar)
			expect(barLines[0].barNumber).toBe(0);
			expect(barLines[0].isPartial).toBeUndefined();
			expect(barLines[0].cumulativeDuration.sinceLastBarLine).toEqual({
				num: 1,
				den: 1
			});

			// Bar 1: D3 (complete 3/4 bar under new meter)
			expect(barLines[1].barNumber).toBe(1);
			expect(barLines[1].isPartial).toBeUndefined();
			expect(barLines[1].cumulativeDuration.sinceLastBarLine).toEqual({
				num: 3,
				den: 4
			});

			// Bar 2: E3 (complete 3/4 bar)
			expect(barLines[2].barNumber).toBe(2);
			expect(barLines[2].isPartial).toBeUndefined();
			expect(barLines[2].cumulativeDuration.sinceLastBarLine).toEqual({
				num: 3,
				den: 4
			});
		});

		test.skip("meter change from 3/4 to 4/4", () => {
			const abc = `X:1
L:1/4
M:3/4
K:C
C3|D3|[M:4/4]E4|F4|]`;

			const parsed = parseAbc(abc);
			const result = getBarInfo(parsed.bars, parsed.barLines, parsed.meter);
			const { barLines } = result;

			expect(barLines[0].barNumber).toBe(0);
			expect(barLines[0].isPartial).toBeUndefined();
			expect(barLines[1].barNumber).toBe(1);
			expect(barLines[1].isPartial).toBeUndefined();

			// After meter change
			expect(barLines[2].barNumber).toBe(2);
			expect(barLines[2].isPartial).toBeUndefined();
			expect(barLines[2].cumulativeDuration.sinceLastBarLine).toEqual({
				num: 1,
				den: 1
			});

			expect(barLines[3].barNumber).toBe(3);
			expect(barLines[3].isPartial).toBeUndefined();
		});

		test.skip("meter change with partial bars", () => {
			const abc = `X:1
L:1/4
M:4/4
K:C
C|D4|[M:3/4]E2:|F|G3|]`;

			const parsed = parseAbc(abc);
			const result = getBarInfo(parsed.bars, parsed.barLines, parsed.meter);
			const { barLines } = result;

			// Bar 0: C2 (anacrusis)
			expect(barLines[0].barNumber).toBe(0);
			expect(barLines[0].isPartial).toBe(true);

			// Bar 1: D4 (complete 4/4 bar)
			expect(barLines[1].barNumber).toBe(1);
			expect(barLines[1].isPartial).toBeUndefined();

			// Bar 2: E2 after meter change to 3/4 (partial)
			expect(barLines[2].barNumber).toBe(2);
			expect(barLines[2].isPartial).toBe(true);
			expect(barLines[2].completesMusicBar).toBeUndefined();
			expect(barLines[2].cumulativeDuration.sinceLastBarLine).toEqual({
				num: 1,
				den: 2
			});

			// Bar 3: F (partial 3/4 bar; completes previous)
			expect(barLines[3].barNumber).toBe(2);
			expect(barLines[3].isPartial).toBe(true);
			expect(barLines[3].completesMusicBar).toBe(true);
			// Bar 4: G3 (complete 3/4 bar)
			expect(barLines[4].barNumber).toBe(3);
			expect(barLines[4].isPartial).toBeUndefined();
		});

		test.skip(//AI-generated; not a useful test
		"meter change with accumulating partial bars", () => {
			const abc = `X:1
L:1/4
M:4/4
K:C
C2|D2|[M:3/4]E2|F|G3|]`;

			const parsed = parseAbc(abc);
			const result = getBarInfo(parsed.bars, parsed.barLines, parsed.meter);
			const { barLines } = result;

			// Bar 0: C2 (anacrusis in 4/4)
			expect(barLines[0].barNumber).toBe(0);
			expect(barLines[0].isPartial).toBe(true);

			// Bar 1: D2 (completes the 4/4 bar with C2)
			expect(barLines[1].barNumber).toBe(0);
			expect(barLines[1].isPartial).toBe(true);
			expect(barLines[1].completesMusicBar).toBe(true);

			// Bar 2: E2 after meter change to 3/4 (partial)
			expect(barLines[2].barNumber).toBe(1);
			expect(barLines[2].isPartial).toBe(true);
			expect(barLines[2].completesMusicBar).toBeUndefined();
			expect(barLines[2].cumulativeDuration.sinceLastComplete).toEqual({
				num: 1,
				den: 2
			});

			// Bar 3: F (still accumulating toward 3/4 bar)
			expect(barLines[3].barNumber).toBe(1);
			expect(barLines[3].isPartial).toBe(true);
			expect(barLines[3].completesMusicBar).toBe(true);
			expect(barLines[3].cumulativeDuration.sinceLastComplete).toEqual({
				num: 3,
				den: 4
			});

			// Bar 4: G3 (complete 3/4 bar)
			expect(barLines[4].barNumber).toBe(2);
			expect(barLines[4].isPartial).toBeUndefined();
		});

		test.skip("meter change with repeat", () => {
			const abc = `X:1
L:1/4
M:4/4
K:C
|:C4|D4:|[M:3/4]E3|F3|]`;

			const parsed = parseAbc(abc);
			const result = getBarInfo(parsed.bars, parsed.barLines, parsed.meter);
			const { barLines } = result;

			// Initial repeat
			expect(barLines[0].barNumber).toBe(null);

			expect(barLines[1].barNumber).toBe(0);
			expect(barLines[2].barNumber).toBe(1);

			// After meter change
			expect(barLines[3].barNumber).toBe(2);
			expect(barLines[3].isPartial).toBeUndefined();
			expect(barLines[3].cumulativeDuration.sinceLastBarLine).toEqual({
				num: 3,
				den: 4
			});

			expect(barLines[4].barNumber).toBe(3);
		});

		test.skip("meter change inside variant endings", () => {
			const abc = `X:1
L:1/4
M:4/4
K:C
C4|D4|[1[M:3/4]E3:|[2[M:2/4]F2||G2|]`;

			const parsed = parseAbc(abc);
			const result = getBarInfo(parsed.bars, parsed.barLines, parsed.meter);
			const { barLines } = result;

			expect(barLines[0].barNumber).toBe(0);
			expect(barLines[1].barNumber).toBe(1);

			// First variant: meter changes to 3/4
			expect(barLines[2].barNumber).toBe(2);
			expect(barLines[2].variantId).toBe(0);
			expect(barLines[2].cumulativeDuration.sinceLastBarLine).toEqual({
				num: 3,
				den: 4
			});

			// Second variant: meter changes to 2/4
			expect(barLines[3].barNumber).toBe(2);
			expect(barLines[3].variantId).toBe(1);
			expect(barLines[3].cumulativeDuration.sinceLastBarLine).toEqual({
				num: 1,
				den: 2
			});

			// After variants: should use meter from last variant (2/4)
			expect(barLines[4].barNumber).toBe(3);
			expect(barLines[4].variantId).toBeUndefined();
			expect(barLines[4].cumulativeDuration.sinceLastBarLine).toEqual({
				num: 1,
				den: 2
			});
		});
	});

	describe("Unit length changes", () => {
		test.skip("unit length change from 1/4 to 1/8", () => {
			const abc = `X:1
L:1/4
M:4/4
K:C
C4|[L:1/8]D8|E8|]`;

			const parsed = parseAbc(abc);
			const result = getBarInfo(parsed.bars, parsed.barLines, parsed.meter);
			const { barLines } = result;

			// Bar 0: C4 with L:1/4
			expect(barLines[0].barNumber).toBe(0);
			expect(barLines[0].isPartial).toBeUndefined();
			expect(barLines[0].cumulativeDuration.sinceLastBarLine).toEqual({
				num: 1,
				den: 1
			});

			// Bar 1: D8 with L:1/8 (still 4/4 time)
			expect(barLines[1].barNumber).toBe(1);
			expect(barLines[1].isPartial).toBeUndefined();
			expect(barLines[1].cumulativeDuration.sinceLastBarLine).toEqual({
				num: 1,
				den: 1
			});

			// Bar 2: E8 with L:1/8
			expect(barLines[2].barNumber).toBe(2);
			expect(barLines[2].isPartial).toBeUndefined();
		});

		test.skip("unit length change from 1/8 to 1/4", () => {
			const abc = `X:1
L:1/8
M:3/4
K:C
C6|D6|[L:1/4]E3|F3|]`;

			const parsed = parseAbc(abc);
			const result = getBarInfo(parsed.bars, parsed.barLines, parsed.meter);
			const { barLines } = result;

			expect(barLines[0].barNumber).toBe(0);
			expect(barLines[0].cumulativeDuration.sinceLastBarLine).toEqual({
				num: 3,
				den: 4
			});

			expect(barLines[1].barNumber).toBe(1);
			expect(barLines[1].cumulativeDuration.sinceLastBarLine).toEqual({
				num: 3,
				den: 4
			});

			// After unit length change
			expect(barLines[2].barNumber).toBe(2);
			expect(barLines[2].cumulativeDuration.sinceLastBarLine).toEqual({
				num: 3,
				den: 4
			});

			expect(barLines[3].barNumber).toBe(3);
		});

		test.skip("unit length change with partial bars", () => {
			const abc = `X:1
L:1/4
M:4/4
K:C
C2|D4|[L:1/8]E4:|F4|G8|]`;

			const parsed = parseAbc(abc);
			const result = getBarInfo(parsed.bars, parsed.barLines, parsed.meter);
			const { barLines } = result;

			// Bar 0: C2 (anacrusis with L:1/4)
			expect(barLines[0].barNumber).toBe(0);
			expect(barLines[0].isPartial).toBe(true);

			// Bar 1: D4 (complete bar)
			expect(barLines[1].barNumber).toBe(1);

			// Bar 2: E4 with L:1/8 (partial - only 1/2 note duration)
			expect(barLines[2].barNumber).toBe(2);
			expect(barLines[2].isPartial).toBe(true);
			expect(barLines[2].cumulativeDuration.sinceLastBarLine).toEqual({
				num: 1,
				den: 2
			});

			// Bar 3: F4 with L:1/8 (complete bar)
			expect(barLines[3].barNumber).toBe(2);
			expect(barLines[3].isPartial).toBe(true);
			// Bar 4: G8 with L:1/8 (complete bar)
			expect(barLines[4].barNumber).toBe(3);
			expect(barLines[4].isPartial).toBe(true);
		});
	});

	describe("Combined meter and unit length changes", () => {
		test.skip("simultaneous meter and unit length change", () => {
			const abc = `X:1
L:1/4
M:4/4
K:C
C4|[M:3/4][L:1/8]D6|E6|]`;

			const parsed = parseAbc(abc);
			const result = getBarInfo(parsed.bars, parsed.barLines, parsed.meter);
			const { barLines } = result;

			expect(barLines[0].barNumber).toBe(0);
			expect(barLines[0].cumulativeDuration.sinceLastBarLine).toEqual({
				num: 1,
				den: 1
			});

			// After both meter and length change
			expect(barLines[1].barNumber).toBe(1);
			expect(barLines[1].isPartial).toBeUndefined();
			expect(barLines[1].cumulativeDuration.sinceLastBarLine).toEqual({
				num: 3,
				den: 4
			});

			expect(barLines[2].barNumber).toBe(2);
		});

		test.skip("separate meter and unit length changes", () => {
			const abc = `X:1
L:1/4
M:4/4
K:C
C4|[M:3/4]D3|[L:1/8]E6|F6|]`;

			const parsed = parseAbc(abc);
			const result = getBarInfo(parsed.bars, parsed.barLines, parsed.meter);
			const { barLines } = result;

			expect(barLines[0].barNumber).toBe(0);
			expect(barLines[1].barNumber).toBe(1);
			expect(barLines[2].barNumber).toBe(2);
			expect(barLines[3].barNumber).toBe(3);

			// All bars should be complete
			expect(barLines[0].isPartial).toBeUndefined();
			expect(barLines[1].isPartial).toBeUndefined();
			expect(barLines[2].isPartial).toBeUndefined();
			expect(barLines[3].isPartial).toBeUndefined();
		});
	});

	describe("Meter changes with divideBarsBy", () => {
		test.skip("midpoints adjust to meter changes", () => {
			const abc = `X:1
L:1/4
M:4/4
K:C
C4|[M:3/4]DEF|GAB|]`;

			const parsed = parseAbc(abc);
			const result = getBarInfo(parsed.bars, parsed.barLines, parsed.meter, {
				divideBarsBy: 2
			});

			const { midpoints } = result;

			// Should have midpoints for bars that can be split
			expect(midpoints.length).toBeGreaterThan(0);

			// First bar (4/4): should split after 2 beats
			// Second bar (3/4): should split after 1.5 beats
			// Exact positions depend on source indices
		});
	});
});
