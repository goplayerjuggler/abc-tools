const { getBarInfo } = require("../src/parse/getBarInfo.js");
const { parseAbc } = require("../src/parse/parser.js");

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
		expect(barLines[0].isPartial).toBeUndefined(); // I prefer to only add the property when it's true
		expect(barLines[0].cumulativeDuration).toBeUndefined(); // No music before it

		// barLines[1]: | after D2 (closes bar 0)
		expect(barLines[1].barNumber).toBe(0);
		expect(barLines[1].isPartial).toBe(true); //anacrucis
		expect(barLines[1].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 2,
		});
		expect(barLines[1].cumulativeDuration.sinceLastComplete).toEqual({
			num: 1,
			den: 2,
		});

		// barLines[2]: | after C4 (closes bar 1)
		expect(barLines[2].barNumber).toBe(1);
		expect(barLines[2].isPartial).toBeUndefined(); // I prefer to only add the property when it's true
		expect(
			barLines[2].cumulativeDuration.sinceLastBarLine.compare(1) === 0
		).toBe(true);
		expect(
			barLines[2].cumulativeDuration.sinceLastComplete.compare(1) === 0
		).toBe(true);

		// barLines[3]: :| after D2 (partial - mid-bar repeat)
		expect(barLines[3].barNumber).toBe(2);
		expect(barLines[3].isPartial).toBe(true);
		expect(barLines[3].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 2,
		});
		expect(barLines[3].cumulativeDuration.sinceLastComplete).toEqual({
			num: 1,
			den: 2,
		});

		// barLines[4]: | after E2 (partial - completes musical bar 2 with previous D2)
		expect(barLines[4].barNumber).toBe(2);
		expect(barLines[4].isPartial).toBe(true);
		expect(barLines[4].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 2,
		});
		expect(
			barLines[4].cumulativeDuration.sinceLastComplete.compare(1) === 0
		).toBe(true);

		// barLines[5]: |] after F4 (closes bar 3)
		expect(barLines[5].barNumber).toBe(3);
		expect(barLines[5].isPartial).toBeUndefined(); // I prefer to only add the property when it's true
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
		expect(barLines[0].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 2,
		});
		expect(barLines[0].cumulativeDuration.sinceLastComplete).toEqual({
			num: 1,
			den: 2,
		});

		// barLines[1]: | after C4 (closes bar 1)
		expect(barLines[1].barNumber).toBe(1);
		expect(barLines[1].isPartial).toBeUndefined();
		expect(
			barLines[1].cumulativeDuration.sinceLastBarLine.compare(1) === 0
		).toBe(true);
		expect(
			barLines[1].cumulativeDuration.sinceLastComplete.compare(1) === 0
		).toBe(true);

		// barLines[2]: :| after [1D2 (partial)
		expect(barLines[2].barNumber).toBe(2);
		expect(barLines[2].isPartial).toBe(true);
		expect(barLines[2].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 2,
		});
		expect(barLines[2].cumulativeDuration.sinceLastComplete).toEqual({
			num: 1,
			den: 2,
		});

		// barLines[3]: || after [2DF (partial)
		expect(barLines[3].barNumber).toBe(2);
		expect(barLines[3].isPartial).toBe(true);
		expect(barLines[3].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 2,
		});
		expect(barLines[3].cumulativeDuration.sinceLastComplete).toEqual({
			num: 1,
			den: 2,
		});

		// barLines[4]: | after G2 (partial - bar 2 anacrusis after section break)
		expect(barLines[4].barNumber).toBe(2);
		expect(barLines[4].isPartial).toBe(true);
		expect(barLines[4].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 2,
		});
		expect(
			barLines[4].cumulativeDuration.sinceLastComplete.compare(1) === 0
		).toBe(true);

		// barLines[5]: | after F4 (closes bar 3)
		expect(barLines[5].barNumber).toBe(3);
		expect(barLines[5].isPartial).toBeUndefined();
		expect(
			barLines[5].cumulativeDuration.sinceLastBarLine.compare(1) === 0
		).toBe(true);
		expect(
			barLines[5].cumulativeDuration.sinceLastComplete.compare(1) === 0
		).toBe(true);

		// barLines[6]: |] after G2 (partial - closes bar 4)
		expect(barLines[6].barNumber).toBe(4);
		expect(barLines[6].isPartial).toBe(true);
		expect(barLines[6].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 2,
		});
		expect(barLines[6].cumulativeDuration.sinceLastComplete).toEqual({
			num: 1,
			den: 2,
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
		expect(barLines[0].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 1,
		});
		expect(barLines[0].cumulativeDuration.sinceLastComplete).toEqual({
			num: 1,
			den: 1,
		});

		// barLines[1]: :| after D2[1D2 (closes bar 1)
		expect(barLines[1].barNumber).toBe(1);
		expect(barLines[1].isPartial).toBeUndefined();
		expect(
			barLines[1].cumulativeDuration.sinceLastBarLine.compare(1) === 0
		).toBe(true);
		expect(
			barLines[1].cumulativeDuration.sinceLastComplete.compare(1) === 0
		).toBe(true);

		// barLines[2]: || after [2FA
		expect(barLines[2].isPartial).toBe(true);
		expect(barLines[2].barNumber).toBe(1);
		/*  Failed test. Details below

● getBarInfo › variant endings in middle of bar        
                                                         
    expect(received).toBe(expected) // Object.is equality

    Expected: 1
    Received: 2

      203 |             // barLines[2]: || after [2FA    
      204 |             expect(barLines[2].isPartial).toBe(true);
    > 205 |             expect(barLines[2].barNumber).toBe(1);
          |    */

		expect(barLines[2].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 1,
		});
		expect(barLines[2].cumulativeDuration.sinceLastComplete).toEqual({
			num: 1,
			den: 1,
		});

		// barLines[3]: |] after G4
		expect(barLines[3].barNumber).toBe(2);
		expect(barLines[3].isPartial).toBeUndefined();
		expect(barLines[3].cumulativeDuration.sinceLastBarLine).toEqual({
			num: 1,
			den: 1,
		});
		expect(barLines[3].cumulativeDuration.sinceLastComplete).toEqual({
			num: 1,
			den: 1,
		});
	});
});
