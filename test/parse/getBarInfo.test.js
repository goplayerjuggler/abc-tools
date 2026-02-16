const { getBarInfo } = require("../../src/parse/getBarInfo.js");
const { parseAbc } = require("../../src/parse/parser.js");

describe("getBarInfo", () => {
	test("initial repeat with partial bars", () => {
		const abc = `X:1
L:1/4
M:4/4
K:C
|:D2|C4|D2:|E2|F4|]`;

		const parsed = parseAbc(abc);
		const result = getBarInfo(parsed.bars, parsed.barLines, parsed.meter);

		const { barLines } = result;

		// barLines[0]: |: initial
		expect(barLines[0].barNumber).toBe(null);
		expect(barLines[0].isPartial).toBeUndefined();
		expect(barLines[0].cumulativeDuration).toBeUndefined();

		// barLines[1]: | after D2 (closes bar 0 - anacrusis)
		expect(barLines[1].barNumber).toBe(0);
		expect(barLines[1].isPartial).toBe(true);
		expect(barLines[1].completesMusicBar).toBeUndefined();
		expect(barLines[1].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 2
		});
		expect(barLines[1].cumulativeDuration.sinceLastComplete).toEqual({
			num: 1,
			den: 2
		});

		// barLines[2]: | after C4 (closes bar 1)
		expect(barLines[2].barNumber).toBe(1);
		expect(barLines[2].isPartial).toBeUndefined();
		expect(barLines[2].completesMusicBar).toBeUndefined();
		expect(
			barLines[2].cumulativeDuration.sinceLastBarLine.compare(1) === 0
		).toBe(true);
		expect(
			barLines[2].cumulativeDuration.sinceLastComplete.compare(1) === 0
		).toBe(true);

		// barLines[3]: :| after D2 (partial - mid-bar repeat)
		expect(barLines[3].barNumber).toBe(2);
		expect(barLines[3].isPartial).toBe(true);
		expect(barLines[3].completesMusicBar).toBeUndefined();
		expect(barLines[3].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 2
		});
		expect(barLines[3].cumulativeDuration.sinceLastComplete).toEqual({
			num: 1,
			den: 2
		});

		// barLines[4]: | after E2 (partial - completes musical bar 2 with previous D2)
		expect(barLines[4].barNumber).toBe(2);
		expect(barLines[4].isPartial).toBe(true);
		expect(barLines[4].completesMusicBar).toBe(true);
		expect(barLines[4].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 2
		});
		expect(
			barLines[4].cumulativeDuration.sinceLastComplete.compare(1) === 0
		).toBe(true);

		// barLines[5]: |] after F4 (closes bar 3)
		expect(barLines[5].barNumber).toBe(3);
		expect(barLines[5].isPartial).toBeUndefined();
		expect(barLines[5].completesMusicBar).toBeUndefined();
		expect(
			barLines[5].cumulativeDuration.sinceLastBarLine.compare(1) === 0
		).toBe(true);
		expect(
			barLines[5].cumulativeDuration.sinceLastComplete.compare(1) === 0
		).toBe(true);
	});

	test("variant endings with partial bars", () => {
		const abc = `X:1
L:1/4
M:4/4
K:C
D2|C4|[1D2:|[2DF||G2|F4|G2|]`;

		const parsed = parseAbc(abc);
		const result = getBarInfo(parsed.bars, parsed.barLines, parsed.meter);

		const { barLines } = result;

		// barLines[0]: | after D2 (anacrusis - bar 0)
		expect(barLines[0].barNumber).toBe(0);
		expect(barLines[0].isPartial).toBe(true);
		expect(barLines[0].completesMusicBar).toBeUndefined();
		expect(barLines[0].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 2
		});
		expect(barLines[0].cumulativeDuration.sinceLastComplete).toEqual({
			num: 1,
			den: 2
		});

		// barLines[1]: | after C4 (closes bar 1)
		expect(barLines[1].barNumber).toBe(1);
		expect(barLines[1].isPartial).toBeUndefined();
		expect(barLines[1].completesMusicBar).toBeUndefined();
		expect(
			barLines[1].cumulativeDuration.sinceLastBarLine.compare(1) === 0
		).toBe(true);
		expect(
			barLines[1].cumulativeDuration.sinceLastComplete.compare(1) === 0
		).toBe(true);

		// barLines[2]: :| after [1D2 (partial, variant 0)
		expect(barLines[2].barNumber).toBe(2);
		expect(barLines[2].variantId).toBe(0);
		expect(barLines[2].isPartial).toBe(true);
		expect(barLines[2].completesMusicBar).toBeUndefined();
		expect(barLines[2].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 2
		});
		expect(barLines[2].cumulativeDuration.sinceLastComplete).toEqual({
			num: 1,
			den: 2
		});

		// barLines[3]: || after [2DF (partial, variant 1)
		expect(barLines[3].barNumber).toBe(2);
		expect(barLines[3].variantId).toBe(1);
		expect(barLines[3].isPartial).toBe(true);
		expect(barLines[3].completesMusicBar).toBeUndefined();
		expect(barLines[3].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 2
		});
		expect(barLines[3].cumulativeDuration.sinceLastComplete).toEqual({
			num: 1,
			den: 2
		});

		// barLines[4]: | after G2 (partial - still in bar 2 despite the preceding section break "||" ! completes musical bar 2)
		expect(barLines[4].barNumber).toBe(2); // 251108 1643: No! Received: 3

		expect(barLines[4].variantId).toBeUndefined();
		expect(barLines[4].isPartial).toBe(true);
		expect(barLines[4].completesMusicBar).toBe(true);
		expect(barLines[4].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 2
		});
		expect(barLines[4].cumulativeDuration.sinceLastComplete).toEqual({
			num: 1,
			den: 1
		});

		// barLines[5]: | after F4 (closes bar 3)
		expect(barLines[5].barNumber).toBe(3);
		expect(barLines[5].isPartial).toBeUndefined();
		expect(barLines[5].completesMusicBar).toBeUndefined();
		expect(
			barLines[5].cumulativeDuration.sinceLastBarLine.compare(1) === 0
		).toBe(true);
		expect(
			barLines[5].cumulativeDuration.sinceLastComplete.compare(1) === 0
		).toBe(true);

		// barLines[6]: |] after G2 (partial - closes bar 4)
		expect(barLines[6].barNumber).toBe(4);
		expect(barLines[6].isPartial).toBe(true);
		expect(barLines[6].completesMusicBar).toBeUndefined();
		expect(barLines[6].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 2
		});
		expect(barLines[6].cumulativeDuration.sinceLastComplete).toEqual({
			num: 1,
			den: 2
		});
	});

	test("variant endings in middle of bar", () => {
		const abc = `X:1
L:1/4
M:4/4
K:C
C4|D2[1D2:|[2FA||G4|]`;

		const parsed = parseAbc(abc);
		const result = getBarInfo(parsed.bars, parsed.barLines, parsed.meter);

		const { barLines } = result;
		expect(barLines.length).toBe(4);

		// barLines[0]: | after C4
		expect(barLines[0].barNumber).toBe(0);
		expect(barLines[0].isPartial).toBeUndefined();
		expect(barLines[0].completesMusicBar).toBeUndefined();
		expect(barLines[0].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 1
		});
		expect(barLines[0].cumulativeDuration.sinceLastComplete).toEqual({
			num: 1,
			den: 1
		});

		// barLines[1]: :| after D2[1D2 (complete bar, variant 0)
		expect(barLines[1].barNumber).toBe(1);
		expect(barLines[1].variantId).toBe(0);
		expect(barLines[1].isPartial).toBeUndefined();
		expect(barLines[1].completesMusicBar).toBeUndefined();
		expect(
			barLines[1].cumulativeDuration.sinceLastBarLine.compare(1) === 0
		).toBe(true);
		expect(
			barLines[1].cumulativeDuration.sinceLastComplete.compare(1) === 0
		).toBe(true);

		// barLines[2]: || after [2FA (partial but completes bar, variant 1)
		expect(barLines[2].barNumber).toBe(1);
		expect(barLines[2].variantId).toBe(1);
		expect(barLines[2].isPartial).toBe(true);
		expect(barLines[2].completesMusicBar).toBe(true);
		expect(barLines[2].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 2
		});
		expect(barLines[2].cumulativeDuration.sinceLastComplete).toEqual({
			num: 1,
			den: 1
		});

		// barLines[3]: |] after G4
		expect(barLines[3].barNumber).toBe(2);
		expect(barLines[3].variantId).toBeUndefined();
		expect(barLines[3].isPartial).toBeUndefined();
		expect(barLines[3].completesMusicBar).toBeUndefined();
		expect(barLines[3].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 1
		});
		expect(barLines[3].cumulativeDuration.sinceLastComplete).toEqual({
			num: 1,
			den: 1
		});
	});

	test("variant repeats at start of bar", () => {
		const abc = `X:1
M:4/4
L:1/4
K:C
C4|D4|E4|1F4:|2G4||
C4|D4|E4|E4|]`;

		const parsed = parseAbc(abc);
		const result = getBarInfo(parsed.bars, parsed.barLines, parsed.meter);

		const { barLines } = result;

		// First three bars (common section)
		expect(barLines[0].barNumber).toBe(0);
		expect(barLines[1].barNumber).toBe(1);
		expect(barLines[2].barNumber).toBe(2);

		// First variant ending
		expect(barLines[3].barNumber).toBe(3);
		expect(barLines[3].variantId).toBe(0);
		expect(barLines[3].isPartial).toBeUndefined();
		expect(barLines[3].completesMusicBar).toBeUndefined();

		// Second variant ending
		expect(barLines[4].barNumber).toBe(3);
		expect(barLines[4].variantId).toBe(1);
		expect(barLines[4].isPartial).toBeUndefined();
		expect(barLines[4].completesMusicBar).toBeUndefined();

		// After section break, variant tracking resets
		expect(barLines[5].barNumber).toBe(4);
		expect(barLines[5].variantId).toBeUndefined();
		expect(barLines[6].barNumber).toBe(5);
		expect(barLines[7].barNumber).toBe(6);
		expect(barLines[8].barNumber).toBe(7);
	});

	test("variant endings in middle of bar (single bar variants)", () => {
		const abc = `X:1
M:4/4
L:1/4
K:C
C4|D4|E4|F3[1G:| [2A||
C4|D4|E4|E4|]`;

		const parsed = parseAbc(abc);
		const result = getBarInfo(parsed.bars, parsed.barLines, parsed.meter);

		const { barLines } = result;

		expect(barLines[0].barNumber).toBe(0);
		expect(barLines[1].barNumber).toBe(1);
		expect(barLines[2].barNumber).toBe(2);

		// First variant: F3[1G completes bar 3
		expect(barLines[3].barNumber).toBe(3);
		expect(barLines[3].variantId).toBe(0);
		expect(barLines[3].isPartial).toBeUndefined();
		expect(barLines[3].completesMusicBar).toBeUndefined();

		// Second variant: [2A is partial but completes bar 3
		expect(barLines[4].barNumber).toBe(3);
		expect(barLines[4].variantId).toBe(1);
		expect(barLines[4].isPartial).toBe(true);
		expect(barLines[4].completesMusicBar).toBe(true);

		// After section break
		expect(barLines[5].barNumber).toBe(4);
		expect(barLines[5].variantId).toBeUndefined();
	});

	test("variant repeats at start of bar, multi-bar variants", () => {
		const abc = `X:1
M:4/4
L:1/4
K:C
C4|D4|E4|1F4|G4|A4:|2FAFA|GBGB|Acac||
C4|D4|E4|E4|]`;

		const parsed = parseAbc(abc);
		const result = getBarInfo(parsed.bars, parsed.barLines, parsed.meter);

		const { barLines } = result;

		expect(barLines[0].barNumber).toBe(0);
		expect(barLines[1].barNumber).toBe(1);
		expect(barLines[2].barNumber).toBe(2);

		// First variant ending (3 bars)
		expect(barLines[3].barNumber).toBe(3);
		expect(barLines[3].variantId).toBe(0);
		expect(barLines[4].barNumber).toBe(4);
		expect(barLines[4].variantId).toBe(0);
		expect(barLines[5].barNumber).toBe(5);
		expect(barLines[5].variantId).toBe(0);

		// Second variant ending (3 bars, same bar numbers)
		expect(barLines[6].barNumber).toBe(3);
		expect(barLines[6].variantId).toBe(1);
		expect(barLines[7].barNumber).toBe(4);
		expect(barLines[7].variantId).toBe(1);
		expect(barLines[8].barNumber).toBe(5);
		expect(barLines[8].variantId).toBe(1);

		// After section break
		expect(barLines[9].barNumber).toBe(6);
		expect(barLines[9].variantId).toBeUndefined();
	});

	test("variant repeats in middle of bar, multi-bar variants", () => {
		const abc = `X:1
M:4/4
L:1/4
K:C
C4|D4|E4|F2 [1A2|G4|A4:|2FA|GBGB|Acac||
C4|D4|E4|E4|]`;

		const parsed = parseAbc(abc);
		const result = getBarInfo(parsed.bars, parsed.barLines, parsed.meter);

		const { barLines } = result;

		expect(barLines[0].barNumber).toBe(0);
		expect(barLines[1].barNumber).toBe(1);
		expect(barLines[2].barNumber).toBe(2);

		// First variant ending (3 bars)
		// F2 [1A2| completes bar 3
		expect(barLines[3].barNumber).toBe(3);
		expect(barLines[3].variantId).toBe(0);
		expect(barLines[3].isPartial).toBeUndefined();
		expect(barLines[3].completesMusicBar).toBeUndefined();

		expect(barLines[4].barNumber).toBe(4);
		expect(barLines[4].variantId).toBe(0);

		expect(barLines[5].barNumber).toBe(5);
		expect(barLines[5].variantId).toBe(0);

		// Second variant ending (3 bars, same bar numbers)
		// [2FA| is partial but completes bar 3
		expect(barLines[6].barNumber).toBe(3);
		expect(barLines[6].variantId).toBe(1);
		expect(barLines[6].isPartial).toBe(true);
		expect(barLines[6].completesMusicBar).toBe(true);

		expect(barLines[7].barNumber).toBe(4);
		expect(barLines[7].variantId).toBe(1);

		expect(barLines[8].barNumber).toBe(5);
		expect(barLines[8].variantId).toBe(1);

		// After section break
		expect(barLines[9].barNumber).toBe(6);
		expect(barLines[9].variantId).toBeUndefined();
	});

	test("variant endings of different lengths", () => {
		const abc = `X:1
M:4/4
L:1/4
K:C
C4|D4|[1E4|F4:|[2G4|A4|B4||
c4|]`;

		const parsed = parseAbc(abc);
		const result = getBarInfo(parsed.bars, parsed.barLines, parsed.meter);

		const { barLines } = result;

		expect(barLines[0].barNumber).toBe(0);
		expect(barLines[1].barNumber).toBe(1);

		// First variant ending (2 bars)
		expect(barLines[2].barNumber).toBe(2);
		expect(barLines[2].variantId).toBe(0);
		expect(barLines[3].barNumber).toBe(3);
		expect(barLines[3].variantId).toBe(0);

		// Second variant ending (3 bars)
		expect(barLines[4].barNumber).toBe(2);
		expect(barLines[4].variantId).toBe(1);
		expect(barLines[5].barNumber).toBe(3);
		expect(barLines[5].variantId).toBe(1);
		expect(barLines[6].barNumber).toBe(4);
		expect(barLines[6].variantId).toBe(1);

		// After section break: should be max(3, 4) + 1 = 5
		expect(barLines[7].barNumber).toBe(5);
		expect(barLines[7].variantId).toBeUndefined();
	});

	test("partials around section breaks", () => {
		const abc = `X:1
T:I Ne'er Shall Wean Her
R:jig
L:1/8
M:6/8
K:C
|:G|EGG GED | EGG c2B|AcA AGA | cde ecd|
cde g2a | ged c2d|eaa e2d | cAA A2:|
|:d|egg ged | egg g2d|eaa aga | baa a2g|
cde g2a | ged c2d|eaa e2d | cAA A2:|
`;
		const parsed = parseAbc(abc);
		getBarInfo(parsed.bars, parsed.barLines, parsed.meter);

		const barLines = parsed.barLines;
		expect(barLines[9].text).toBe(":|");
		expect(barLines[9].isPartial).toBe(true);
		expect(barLines[9].barNumber).toBe(8);

		expect(barLines[10].text).toBe("|:");
		expect(barLines[10].isPartial).toBe(true);
		expect(barLines[10].barNumber).toBe(8);
		expect(barLines[10].completesMusicBar).toBeUndefined();

		expect(barLines[11].text).toBe("|");
		expect(barLines[11].isPartial).toBe(true);
		expect(barLines[11].barNumber).toBe(8);
		expect(barLines[11].completesMusicBar).toBe(true);
	});
});
