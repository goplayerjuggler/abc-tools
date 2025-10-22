const {
	getFirstBars,
	hasAnacrucis,
	toggleMeter_4_4_to_4_2,
	toggleMeter_6_8_to_12_8,
	getIncipit,
	normaliseKey,
} = require("../src/index.js");

// ============================================================================
// ABC MANIPULATION TESTS
// Based on manipulation.js - comprehensive tests for ABC manipulations
// ============================================================================

describe("normaliseKey", () => {
	test("gives an array of two elements", () => {
		let result, keyHeader;
		keyHeader = "D";
		result = normaliseKey(keyHeader);
		expect(result.length).toBe(2);
		expect(result[0]).toBe("D");
		expect(result[1]).toBe("major");
		keyHeader = "Aaeol";
		result = normaliseKey(keyHeader);
		expect(result.length).toBe(2);
		expect(result[0]).toBe("A");
		expect(result[1]).toBe("minor");
		keyHeader = "D#mixo";
		result = normaliseKey(keyHeader);
		expect(result.length).toBe(2);
		expect(result[0]).toBe("D♯");
		expect(result[1]).toBe("mixolydian");
	});
});

describe("ABC Manipulator - getFirstBars functionality", () => {
	const tuneWithAnacrusis = `X:1
T:Example Tune
M:4/4
L:1/8
K:D
FA | d2 cB A2 FA | d2 f2 e2 d2 |`;

	const tuneWithoutAnacrusis = `X:1
T:No Pickup
M:4/4
L:1/8
K:D
D2 FA dA FD | G2 Bc d2 cB | A2 AB c2 BA |]`;

	const tuneWithAnacrusisAndChords = `X:1
T:tuneWithAnacrusisAndChords
M:4/4
L:1/8
K:D
"F#-"FA | "D"d2 cB "F#-"A2 FA |"D"d2 f2 "A"e2 d2 |]`;

	const tuneWithChordsWithoutAnacrusis = `X:1
T:tuneWithChordsWithoutAnacrusis
M:4/4
L:1/8
K:D
"D"d2 cB "F#-"A2 FA |"D"d2 f2 "A"e2 d2 |`;

	const cotillon_aComplexMultiFeaturedTune = `%with double stops and phrase marks
X: 1 %230324
T: Cotillon de Baie-Ste-Catherine
R: reel
S: Laurie Hart
D: Danse ce soir ! Traditional tunes of Québec • 2001
F: https://music.youtube.com/watch?v=MIXYs91NGH8
M: 4/4
L: 1/16
Q: 1/4=110
Z: Transcribed by Malcolm Schonfield
P:A4.B3
K: Gmaj
G3A[P:A] |:!segno! B2[BE][BE] EBGB dedB cdcB | AGFG {AB}A2GB [1,3 dedc BAGA:| [2,4 .d2F2 [2G3A :| [4 G3B |
| [M:1/4] dcBc  [P:B] |: [M:5/4] d2.g2 .D2.g2 .D2.g2 D2[DB][DB] [Dc][DB][DA][DB] |1,2 c2.a2 [D2A2]a2 .a2.a2 D2[DB][Dc] [Dd][Dc][DB][Dc] :|3 [M: 4/4] c2a2 {ga}[g2A2][f2A2] .g2.g2 G3!D.S.!A|]`;
	describe("single bar extraction", () => {
		test("extracts first bar from tune with anacrusis (excluding pickup)", () => {
			const result = getFirstBars(tuneWithAnacrusis, 1, false);

			expect(result).toContain(`X:1
T:Example Tune
M:4/4
L:1/8
K:D\nd2 cB A2 FA`);
			expect(result).not.toContain("K:D\nFA |"); // anacrusis excluded
			expect(result).not.toContain("d2 f2 e2 d2");
		});
		test("extracts first bar from tune with anacrusis (excluding pickup) - with chords", () => {
			const result = getFirstBars(tuneWithAnacrusisAndChords, 1, false);

			expect(result).toContain(`X:1
T:tuneWithAnacrusisAndChords
M:4/4
L:1/8
K:D`);
			expect(result).toContain('K:D\n"D"d2 cB "F#-"A2 FA');
			expect(result).not.toContain('K:D\n"F#-"FA |'); // anacrusis excluded
			expect(result).not.toContain('"D"d2 f2 "A"e2 d2');
		});
		test("extracts first bar from tune with anacrusis (including pickup)", () => {
			const result = getFirstBars(tuneWithAnacrusis, 1, true);

			expect(result).toContain("FA |"); // anacrusis included
			expect(result).toContain("d2 cB A2 FA");
			expect(result).not.toContain("d2 f2 e2 d2");
		});
		test("extracts first bar from tune with anacrusis (including pickup) - with chords", () => {
			const result = getFirstBars(tuneWithAnacrusisAndChords, 1, true);

			expect(result).toContain(`X:1
T:tuneWithAnacrusisAndChords
M:4/4
L:1/8
K:D`);
			expect(result).toContain('K:D\n"F#-"FA | "D"d2 cB "F#-"A2 FA');
			expect(result).not.toContain('K:D\n"D"d2 cB');
			expect(result).not.toContain('|"D"d2 f2 "A"e2 d2');
		});
		test("extracts first bar from tune without anacrusis", () => {
			const result = getFirstBars(tuneWithoutAnacrusis, 1, false);

			expect(result).toContain("D2 FA dA FD");
			expect(result).not.toContain("G2 Bc d2 cB");
		});
		test("extracts first bar from tune with chords without anacrusis", () => {
			const result = getFirstBars(tuneWithChordsWithoutAnacrusis, 1, false);

			expect(result).toContain('K:D\n"D"d2 cB "F#-"A2 FA');
			expect(result).not.toContain('|"D"d2 f2 "A"e2 d2');
		});
		test("extracts first bar from complex tune with anacrusis - cotillon", () => {
			const result = getFirstBars(cotillon_aComplexMultiFeaturedTune, 1, false);
			expect(result).toContain("K: Gmaj\n!segno! B2[BE][BE] EBGB dedB cdcB");
			expect(result).not.toContain("AGFG");
		});
	});

	describe("multiple bar extraction", () => {
		test("extracts first bar (including anacrusis)", () => {
			const result = getFirstBars(tuneWithAnacrusis, 1, true);

			expect(result).toContain("K:D\nFA |"); // anacrusis included
			expect(result).toContain("d2 cB A2 FA");
			expect(result).not.toContain("d2 f2 e2 d2");
		});
		test("extracts first two bars (excluding anacrusis)", () => {
			const result = getFirstBars(tuneWithAnacrusis, 2, false);

			expect(result).not.toContain("K:D\nFA |"); // anacrusis excluded
			expect(result).toContain("K:D\nd2 cB A2 FA");
			expect(result).toContain("d2 f2 e2 d2");
		});

		test("extracts first two bars (including anacrusis)", () => {
			const result = getFirstBars(tuneWithAnacrusis, 2, true);

			expect(result).toContain("K:D\nFA |"); // anacrusis included
			expect(result).toContain("d2 cB A2 FA");
			expect(result).toContain("d2 f2 e2 d2");
		});

		test("extracts first bar from complex tune, including anacrucis", () => {
			const result = getFirstBars(cotillon_aComplexMultiFeaturedTune, 1, true);
			expect(result).toContain(
				"K: Gmaj\nG3A[P:A] |:!segno! B2[BE][BE] EBGB dedB cdcB"
			);
			expect(result).not.toContain("AGFG");
		});

		test("extracts first three bars from longer tune", () => {
			const longerTune = `X:1
T:Longer Tune
M:4/4
L:1/8
K:D
D2 FA dA FD | G2 Bc d2 cB |
A2 AB c2 BA | G2 FE D4 |
d2 fd e2 ce | B2 GB A4 |]`;

			const result = getFirstBars(longerTune, 3);

			expect(result).toContain("D2 FA dA FD");
			expect(result).toContain("G2 Bc d2 cB");
			expect(result).toContain("A2 AB c2 BA");
			expect(result).not.toContain("G2 FE D4");
			expect(result).not.toContain("d2 fd e2 ce");
		});
		test("ignores first bar symbol when nothing precedes it", () => {
			const abc =
				"X: 1\nT: The Silver Slipper\nM: 2/2\nL: 1/8\nK: D\n|:FD ~D2 FD ~D2|AFdA FD ~D2|FDFA B<GEA:|\nM: 3/4\n|:FA dc d2|FA dA (3Bcd|FA dc ~d2|BG EF GE|\nFA dc d2|FA dA (3Bcd|ec dA FA|1 BG EF GE:|2 [M: 1/2]BG E!D.C.!G ||";
			const result = getFirstBars(abc, 2, true, true, { all: true });
			expect(result).toContain("|AFdA FD ~D2");
		});
	});

	describe("different time signatures", () => {
		test("extracts first bar from 6/8 tune", () => {
			const jig = `X:1
T:Simple Jig
M:6/8
L:1/8
K:D
DFA dAF | GBd gdB |
AFD DFA | G2E E3 |]`;

			const result = getFirstBars(jig, 1);

			expect(result).toContain("DFA dAF");
			expect(result).not.toContain("GBd gdB");
		});

		test("extracts first bar from 6/8 tune with anacrusis", () => {
			const jigWithPickup = `X:1
T:Jig with Pickup
M:6/8
L:1/8
K:D
FA | DFA dAF | GBd gdB |]`;

			const resultWithout = getFirstBars(jigWithPickup, 1, false);
			const resultWith = getFirstBars(jigWithPickup, 1, true);

			expect(resultWithout).not.toContain("FA |");
			expect(resultWithout).toContain("DFA dAF");

			expect(resultWith).toContain("FA |");
			expect(resultWith).toContain("DFA dAF");
		});
	});

	describe("error handling", () => {
		test("throws error when requesting more bars than available", () => {
			expect(() => {
				getFirstBars(tuneWithAnacrusis, 10);
			}).toThrow("Not enough bars to satisfy request. Requested 10 bars.");
		});

		test("throws error when no complete bars found", () => {
			const onlyAnacrusis = `X:1
T:Only Pickup
M:4/4
L:1/8
K:D
FA |]`;

			expect(() => {
				getFirstBars(onlyAnacrusis, 1);
			}).toThrow("No complete bars found");
		});
	});
});

describe("ABC Manipulator - getFirstBars with partial bars", () => {
	const tuneWithAnacrusis = `X:1
T:Example Tune
M:4/4
L:1/8
K:D
FA | d2 cB A2 FA | d2 f2 e2 d2 | c2 BA G2 FE |]`;

	const tune3_4 = `X:1
T:with anacrucis
L:1/4
M:3/4
K:D
E/F/ | DEF | EFG | FGA | GAB |]`;

	describe("fractional bar extraction (without anacrusis)", () => {
		test("extracts 1.5 bars as numeric value", () => {
			const result = getFirstBars(tuneWithAnacrusis, 1.5, false);

			expect(result).toContain("K:D");
			expect(result).toContain("d2 cB A2 FA"); // full first bar
			expect(result).toContain("d2 f2"); // half of second bar (4 eighth notes)
			expect(result).not.toContain("e2 d2"); // rest of second bar excluded
			expect(result).not.toContain("K:D\nFA |"); // anacrusis excluded
		});

		test("extracts 1.5 bars using Fraction", () => {
			const { Fraction } = require("../src/math.js");
			const result = getFirstBars(tuneWithAnacrusis, new Fraction(3, 2), false);

			expect(result).toContain("d2 cB A2 FA");
			expect(result).toContain("d2 f2");
			expect(result).not.toContain("e2 d2");
		});

		test("extracts 0.5 bars", () => {
			const result = getFirstBars(tuneWithAnacrusis, 0.5, false);

			expect(result).toContain("d2 cB"); // half of first complete bar (4 eighth notes)
			expect(result).not.toContain("A2 FA");
			expect(result).not.toContain("FA |"); // anacrusis excluded
		});

		test("extracts 2.25 bars", () => {
			const result = getFirstBars(tuneWithAnacrusis, 2.25, false);

			expect(result).toContain("K:D\nd2 cB A2 FA | d2 f2 e2 d2 | c2"); // bar 1-2; bar 3 (2 eighth notes)
			expect(result).not.toContain("BA G2 FE |]");
		});
	});

	describe("fractional bars with 3/4 meter", () => {
		test("extracts 1.5 bars without anacrusis", () => {
			const result = getFirstBars(tune3_4, 1.5, false);

			expect(result).toContain("DEF"); // full first bar
			expect(result).toContain("EF"); // half of second bar
			expect(result).not.toContain("G"); // rest of second bar excluded
			expect(result).not.toContain("E/F/ |"); // anacrusis excluded
		});

		test("extracts 0.5 bars (1.5 quarter notes)", () => {
			const result = getFirstBars(tune3_4, 0.5, false);

			expect(result).toContain("DE"); // half of first complete bar
			expect(result).not.toContain("F");
			expect(result).not.toContain("E/F/ |");
		});
	});

	describe("partial bars with anacrusis included", () => {
		test("extracts 1.5 bars with anacrusis, not counting it", () => {
			const result = getFirstBars(tuneWithAnacrusis, 1.5, true, false);

			expect(result).toContain("FA |"); // anacrusis included but not counted
			expect(result).toContain("d2 cB A2 FA"); // full first bar
			expect(result).toContain("d2 f2"); // half of second bar
			expect(result).not.toContain("e2 d2");
		});

		test("extracts 2 bars worth with anacrusis counted in total (3/4)", () => {
			const result = getFirstBars(tune3_4, 2, true, true);

			// Target: 2 * 3/4 = 6/4
			// Anacrusis: 1/8 (E/F/)
			// Remaining needed: 6/4 - 1/8 = 12/8 - 1/8 = 11/8
			// Bar 1 (DEF): 3/4 = 6/8
			// Remaining: 11/8 - 6/8 = 5/8
			// Bar 2: need 5/8 worth = EF (2/4 = 4/8) + part of G
			// Actually 5/8 = 2.5 quarter notes = EF and half of G... but G is 1/4
			// Let me recalculate: 11/8 quarters = 11/8 * 1/4 duration units
			// Wait, L:1/4 so each quarter note is 1 unit
			// Target: 2 * 3 = 6 quarter notes
			// Anacrusis: 1/2 quarter note (E/F/)
			// Remaining: 6 - 0.5 = 5.5 quarter notes
			// Bar 1: DEF = 3 quarter notes, accumulated = 3
			// Bar 2: EF = 2 quarter notes, accumulated = 5, need 0.5 more
			// So should get E/F/ | DEF | EF

			expect(result).toContain("E/F/ |"); // anacrusis
			expect(result).toContain("DEF"); // first complete bar
			expect(result).toContain("EF"); // part of second bar
			expect(result).not.toContain("| EFG"); // should not have full second bar
		});

		test("extracts 1 bar worth with anacrusis counted (4/4)", () => {
			const result = getFirstBars(tuneWithAnacrusis, 1, true, true);

			// Target: 1 * 8/8 = 8 eighth notes
			// Anacrusis: FA = 2 eighth notes
			// Remaining: 8 - 2 = 6 eighth notes
			// Bar 1 starts with: d2 cB A2 FA (8 eighth notes total)
			// We need 6 eighth notes: d2 cB A2 (6 eighth notes)

			expect(result).toContain("FA |"); // anacrusis
			expect(result).toContain("d2 cB A2"); // 6 eighth notes
			expect(result).not.toContain("FA | d2 cB A2 FA"); // should not have full bar
		});

		test("extracts 0.5 bars worth with anacrusis counted", () => {
			const result = getFirstBars(tuneWithAnacrusis, 0.5, true, true);

			// Target: 0.5 * 8 = 4 eighth notes
			// Anacrusis: FA = 2 eighth notes
			// Remaining: 4 - 2 = 2 eighth notes
			// Should get: FA | d2

			expect(result).toContain("FA |");
			expect(result).toContain("d2");
			expect(result).not.toContain("cB");
		});
	});

	describe("edge cases for partial bars", () => {
		test("extracts exactly 1.0 bars (should match integer behavior)", () => {
			const resultInt = getFirstBars(tuneWithAnacrusis, 1, false);
			const resultFloat = getFirstBars(tuneWithAnacrusis, 1.0, false);

			expect(resultFloat).toBe(resultInt);
		});

		test("extracts exactly 2.0 bars using Fraction", () => {
			const { Fraction } = require("../src/math.js");
			const resultInt = getFirstBars(tuneWithAnacrusis, 2, false);
			const resultFrac = getFirstBars(
				tuneWithAnacrusis,
				new Fraction(2, 1),
				false
			);

			expect(resultFrac).toBe(resultInt);
		});

		test("handles very small fractions (0.25 bars)", () => {
			const result = getFirstBars(tuneWithAnacrusis, 0.25, false);

			// 0.25 * 8 = 2 eighth notes
			expect(result).toContain("d2");
			expect(result).not.toContain("cB");
		});

		test("throws error when requesting more than available", () => {
			expect(() => {
				getFirstBars(tuneWithAnacrusis, 10.5);
			}).toThrow("Not enough bars");
		});
	});

	describe("preserves formatting with partial bars", () => {
		test("maintains spacing in partial bar extraction", () => {
			const tuneWithSpacing = `X:1
M:4/4
L:1/8
K:D
D2 FA  dA FD | G2 Bc  d2 cB |]`;

			const result = getFirstBars(tuneWithSpacing, 1.5, false);

			// Should preserve the double space
			expect(result).toContain("D2 FA  dA FD");
		});
	});
});

describe("ABC Manipulator - getFirstBars parameter combinations", () => {
	const tuneWithAnacrusis = `X:1
T:Test
M:4/4
L:1/8
K:D
FA | d2 cB A2 FA | d2 f2 e2 d2 |]`;

	test("withAnacrucis=false, countAnacrucisInTotal=false (default)", () => {
		const result = getFirstBars(tuneWithAnacrusis, 1, false, false);

		expect(result).not.toContain("K:D\nFA |");
		expect(result).toContain("d2 cB A2 FA");
	});

	test("withAnacrucis=true, countAnacrucisInTotal=false", () => {
		const result = getFirstBars(tuneWithAnacrusis, 1, true, false);

		expect(result).toContain("FA |"); // included
		expect(result).toContain("d2 cB A2 FA"); // full bar after anacrusis
	});

	test("withAnacrucis=true, countAnacrucisInTotal=true", () => {
		const result = getFirstBars(tuneWithAnacrusis, 1, true, true);

		expect(result).toContain("FA |"); // included
		expect(result).toContain("d2 cB A2"); // partial bar (6 eighth notes to complete 1 bar worth)
		expect(result).not.toContain("d2 cB A2 FA"); // should not have full bar
	});

	test("withAnacrucis=false, countAnacrucisInTotal=true (ignored)", () => {
		// countAnacrucisInTotal should be ignored when withAnacrucis is false
		const result = getFirstBars(tuneWithAnacrusis, 1, false, true);

		expect(result).not.toContain("K:D\nFA |");
		expect(result).toContain("d2 cB A2 FA");
	});
});

describe("ABC Manipulator - hasAnacrucis detection", () => {
	test("detects anacrusis in various meters", () => {
		const cases = [
			{
				meter: "4/4",
				abc: "X:1\nM:4/4\nL:1/8\nK:D\nFA | d2 cB A2 FA |",
				expected: true,
			},
			{
				meter: "4/4",
				abc: "X:1\nM:4/4\nL:1/8\nK:D\nD2 FA dA FD | G2 Bc d2 cB |",
				expected: false,
			},
			{
				meter: "6/8",
				abc: "X:1\nM:6/8\nL:1/8\nK:D\nFA | DFA dAF |",
				expected: true,
			},
			{
				meter: "6/8",
				abc: "X:1\nM:6/8\nL:1/8\nK:D\nDFA dAF | GBd gdB |",
				expected: false,
			},
			{
				meter: "4/2",
				abc: "X:1\nM:4/2\nL:1/8\nK:D\nFA | d2 cB A2 FA d2 f2 e2 d2 |",
				expected: true,
			},
			{
				meter: "12/8",
				abc: "X:1\nM:12/8\nL:1/8\nK:D\nDFA dAF GBd gdB |",
				expected: false,
			},
		];

		cases.forEach(({ abc, expected }) => {
			expect(hasAnacrucis(abc)).toBe(expected);
		});
	});
});

describe("ABC Manipulator - meter toggles (4/4 ↔ 4/2)", () => {
	describe("4/4 to 4/2 conversion", () => {
		test("converts simple 4/4 to 4/2", () => {
			const tune_4_4 = `X:1
T:Example in 4/4
M:4/4
L:1/8
K:D
D2 FA dA FD | G2 Bc d2 cB |
A2 AB c2 BA | G2 FE D4 |]`;

			const result = toggleMeter_4_4_to_4_2(tune_4_4);

			expect(result).toContain("M:4/2");
			expect(result).not.toContain("M:4/4");

			// Should merge pairs of bars
			const barCount = (result.match(/\|/g) || []).length;
			const originalBarCount = (tune_4_4.match(/\|/g) || []).length;
			expect(barCount).toBeLessThan(originalBarCount);
		});

		test("converts 4/4 with anacrusis to 4/2", () => {
			const tune_4_4_anacrusis = `X:1
T:With Anacrusis
M:4/4
L:1/8
K:D
FA | d2 cB A2 FA | d2 f2 e2 d2 |
c2 BA G2 FE | D4 D4 |]`;

			const result = toggleMeter_4_4_to_4_2(tune_4_4_anacrusis);

			expect(result).toContain("M:4/2");
			expect(result).toContain("FA |"); // anacrusis preserved

			// Verify it's reversible
			const restored = toggleMeter_4_4_to_4_2(result);
			expect(restored).toBe(tune_4_4_anacrusis);
		});
	});

	describe("4/2 to 4/4 conversion", () => {
		test("converts simple 4/2 to 4/4", () => {
			const tune_4_2 = `X:1
T:Example in 4/2
M:4/2
L:1/8
K:D
D2 FA dA FD G2 Bc d2 cB |A2 AB c2 BA G2 FE D4 |]`;

			const result = toggleMeter_4_4_to_4_2(tune_4_2);

			expect(result).toContain("M:4/4");
			expect(result).not.toContain("M:4/2");

			// Should split bars in half
			const barCount = (result.match(/\|/g) || []).length;
			const originalBarCount = (tune_4_2.match(/\|/g) || []).length;
			expect(barCount).toBeGreaterThan(originalBarCount);
		});

		test("converts 4/2 with anacrusis to 4/4", () => {
			const tune_4_2_anacrusis = `X:1
T:4/2 with Anacrusis
M:4/2
L:1/8
K:D
FA | d2 cB A2 FA d2 f2 e2 d2 |c2 BA G2 FE D4 D4 |]`;

			const result = toggleMeter_4_4_to_4_2(tune_4_2_anacrusis);

			expect(result).toContain("M:4/4");
			expect(result).toContain("FA |"); // anacrusis preserved

			// Verify it's reversible
			const restored = toggleMeter_4_4_to_4_2(result);
			expect(restored).toBe(tune_4_2_anacrusis);
		});
	});

	describe("reversibility", () => {
		test("4/4 → 4/2 → 4/4 preserves original", () => {
			const original = `X:1
T:Reversibility Test
M:4/4
L:1/8
K:D
D2 FA dA FD | G2 Bc d2 cB |
A2 AB c2 BA | G2 FE D4 |]`;

			const to_4_2 = toggleMeter_4_4_to_4_2(original);
			const back_to_4_4 = toggleMeter_4_4_to_4_2(to_4_2);

			expect(back_to_4_4).toBe(original);
		});

		test("4/2 → 4/4 → 4/2 preserves original", () => {
			const original = `X:1
T:Reversibility Test
M:4/2
L:1/8
K:D
D2 FA dA FD G2 Bc d2 cB |A2 AB c2 BA G2 FE D4 |]`;

			const to_4_4 = toggleMeter_4_4_to_4_2(original);
			const back_to_4_2 = toggleMeter_4_4_to_4_2(to_4_4);

			expect(back_to_4_2).toBe(original);
		});
	});
});

describe("ABC Manipulator - meter toggles (6/8 ↔ 12/8)", () => {
	describe("6/8 to 12/8 conversion", () => {
		test("converts simple 6/8 to 12/8", () => {
			const tune_6_8 = `X:1
T:Example in 6/8
M:6/8
L:1/8
K:D
DFA dAF | GBd gdB |
AFD DFA | G2E E3 |]`;

			const result = toggleMeter_6_8_to_12_8(tune_6_8);

			expect(result).toContain("M:12/8");
			expect(result).not.toContain("M:6/8");

			// Should merge pairs of bars
			const barCount = (result.match(/\|/g) || []).length;
			const originalBarCount = (tune_6_8.match(/\|/g) || []).length;
			expect(barCount).toBeLessThan(originalBarCount);
		});

		test("converts 6/8 with anacrusis to 12/8, normalising spacing when removing bars", () => {
			const tune_6_8_anacrusis = `X:1
T:Jig with Anacrusis
M:6/8
L:1/8
K:D
FA | DFA dAF | GBd gdB |
AFD DFA|G2E E3|
AFD DFA| G2E E3 |]`;

			const result = toggleMeter_6_8_to_12_8(tune_6_8_anacrusis);

			expect(result).toContain("M:12/8");
			expect(result).toContain("FA | DFA dAF GBd gdB |"); // anacrusis preserved; spacing normalised
			expect(result).toContain("AFD DFA G2E E3 |\n"); // spacing normalised
			expect(result).toContain("AFD DFA G2E E3 |]"); // spacing normalised
		});
	});

	describe("12/8 to 6/8 conversion", () => {
		test("converts simple 12/8 to 6/8", () => {
			const tune_12_8 = `X:1
T:Example in 12/8
M:12/8
L:1/8
K:D
DFA dAF GBd gdB |AFD DFA G2E E3 |]`;

			const result = toggleMeter_6_8_to_12_8(tune_12_8);

			expect(result).toContain("M:6/8");
			expect(result).not.toContain("M:12/8");

			// Should split bars in half
			const barCount = (result.match(/\|/g) || []).length;
			const originalBarCount = (tune_12_8.match(/\|/g) || []).length;
			expect(barCount).toBeGreaterThan(originalBarCount);
		});

		test("converts 12/8 with anacrusis to 6/8", () => {
			const tune_12_8_anacrusis = `X:1
T:12/8 with Anacrusis
M:12/8
L:1/8
K:D
FA | DFA dAF GBd gdB |AFD DFA G2E E3 |]`;

			const result = toggleMeter_6_8_to_12_8(tune_12_8_anacrusis);

			expect(result).toContain("M:6/8");
			expect(result).toContain("FA |"); // anacrusis preserved

			// Verify it's reversible
			const restored = toggleMeter_6_8_to_12_8(result);
			expect(restored).toBe(tune_12_8_anacrusis);
		});
	});

	describe("reversibility", () => {
		test("6/8 → 12/8 → 6/8 preserves original", () => {
			const original = `X:1
T:Reversibility Test
M:6/8
L:1/8
K:D
DFA dAF | GBd gdB |
AFD DFA | G2E E3 |]`;

			const to_12_8 = toggleMeter_6_8_to_12_8(original);
			const back_to_6_8 = toggleMeter_6_8_to_12_8(to_12_8);

			expect(back_to_6_8).toBe(original);
		});

		test("12/8 → 6/8 → 12/8 preserves original", () => {
			const original = `X:1
T:Reversibility Test
M:12/8
L:1/8
K:D
DFA dAF GBd gdB |AFD DFA G2E E3 |]`;

			const to_6_8 = toggleMeter_6_8_to_12_8(original);
			const back_to_12_8 = toggleMeter_6_8_to_12_8(to_6_8);

			expect(back_to_12_8).toBe(original);
		});
	});
});

describe("ABC Manipulator - error handling", () => {
	//   test('throws error for wrong unit length in 4/4 toggle', () => {
	//     const wrongUnitLength = `X:1
	// M:4/4
	// L:1/4
	// K:D
	// D F A d | D F A d |]`;

	//     expect(() => {
	//       toggleMeter_4_4_to_4_2(wrongUnitLength);
	//     }).toThrow('This function only works with L:1/8');
	//   });

	test("throws error for wrong meter in 4/4 toggle", () => {
		const wrongMeter = `X:1
M:3/4
L:1/8
K:D
D2 FA |]`;

		expect(() => {
			toggleMeter_4_4_to_4_2(wrongMeter);
		}).toThrow("Meter must be 4/4 or 4/2");
	});

	test("throws error for wrong meter in 6/8 toggle", () => {
		const wrongMeter = `X:1
M:3/4
L:1/8
K:D
D2 FA |]`;

		expect(() => {
			toggleMeter_6_8_to_12_8(wrongMeter);
		}).toThrow("Meter must be 6/8 or 12/8");
	});
});

describe("ABC Manipulator - getIncipit", () => {
	const tuneWithAnacrusis = `X:1
T:Example Tune
M:4/4
L:1/8
K:D
FA | d2 cB A2 FA | d2 f2 e2 d2 | AAAA AAAA`;

	//   const tuneWithoutAnacrusis = `X:1
	// T:No Pickup
	// M:4/4
	// L:1/8
	// K:D
	// D2 FA dA FD | G2 Bc d2 cB | A2 AB c2 BA |]`;

	describe("default incipit", () => {
		test("two bars’ worth; no title", () => {
			const result = getIncipit({ abc: tuneWithAnacrusis });

			expect(result).toContain("X:1");
			expect(result).not.toContain("T:Example Tune");
			expect(result).toContain("M:4/4");
			expect(result).toContain("L:1/8");
			expect(result).toContain("K:D\nFA | d2 cB A2 FA | d2 f2 e2"); // anacrusis included
			expect(result).not.toContain("d2 | AAAA");
		});
	});
});
