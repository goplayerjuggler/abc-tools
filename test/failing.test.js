const {
	toggleMeter_4_4_to_4_2,
	toggleMeter_6_8_to_12_8
} = require("../src/index.js");

// ============================================================================
// FAILING TESTS
// These tests document known issues that are not currently being addressed
// They are kept separate to maintain a clean test suite while tracking
// technical debt and future improvements
// How to run: 1) get rid of `.skip`; 2) `npm run test -- failing -t fail`
// ============================================================================

describe("ABC Manipulator - Known Failing Cases", () => {
	describe("meter toggles (4/4 ↔ 4/2)", () => {
		describe("4/4 to 4/2 conversion with accidentals", () => {
			test("converts simple 4/4 to 4/2", () => {
				const tune_4_4 = `X:1
T:Example in 4/4
M:4/4
L:1/8
K: D dorian
D2 F2 D2 G^F | D2 F2 D2 G^F |]`;

				const result = toggleMeter_4_4_to_4_2(tune_4_4);

				expect(result).toContain("M:4/2");
				expect(result).not.toContain("M:4/4");

				// Should merge pairs of bars
				const barCount = (result.match(/\|/g) || []).length;
				const originalBarCount = (tune_4_4.match(/\|/g) || []).length;
				expect(barCount).toBeLessThan(originalBarCount);
				//
				expect(result).toContain("D2 F2 D2 G^F D2 =F2 D2 G^F"); //should have F natural (`=F`)
			});
		});

		describe("4/2 to 4/4 conversion", () => {
			test("converts simple 4/2 to 4/4", () => {
				const tune_4_2 = `X:1
T:Example in 4/2
M:4/2
L:1/8
K:D dorian
D2 F2 D2 G^F D2 =F2 D2 G^F |]`;

				const result = toggleMeter_4_4_to_4_2(tune_4_2);

				expect(result).toContain("M:4/4");
				expect(result).not.toContain("M:4/2");

				// Should split bars in half
				const barCount = (result.match(/\|/g) || []).length;
				const originalBarCount = (tune_4_2.match(/\|/g) || []).length;
				expect(barCount).toBeGreaterThan(originalBarCount);

				expect(result.toContain("D2 F2 D2 G^F | D2 F2 D2 G^F")); //"no F natural"
			});
		});
	});

	describe("4/4 to 4/2 toggles with inline comments", () => {
		test.skip("4/4 with inline comments inverse", () => {
			const with_comments = `X:1
T:With Comments
M:4/4
L:1/8
K:D
D2 FA dA FD | % first bar
G2 Bc d2 cB | % second bar
A2 AB c2 BA | G2 FE D4 |]`;

			const transformed = toggleMeter_4_4_to_4_2(with_comments);
			const restored = toggleMeter_4_4_to_4_2(transformed);

			// Not handled: Inline comments after bar lines cause issues
			// during bar line manipulation. The current implementation
			// does not preserve comments
			//
			// This is a low-priority topic as inline comments are relatively
			// uncommon in ABC notation, and the transformation still produces
			// valid ABC (just without preserved comments).

			expect(restored).not.toContain("first bar");
			// console.log(transformed);
			expect(restored).toContain(`
K:D
D2 FA dA FD |
G2 Bc d2 cB |
A2 AB c2 BA | G2 FE D4 |]`); //fails! first bar line appears at start of second line rather than end of first.
		});

		test.skip("6/8 with inline comments inverse", () => {
			const with_comments = `X:1
T:Jig with Comments
M:6/8
L:1/8
K:D
DFA dAF | % first bar
GBd gdB | % second bar
AFD DFA | G2E E3 |]`;

			const transformed = toggleMeter_6_8_to_12_8(with_comments);
			const restored = toggleMeter_6_8_to_12_8(transformed);

			// Same issue as above for 6/8 to 12/8 transformations
			expect(restored).toBe(with_comments);
		});
	});

	describe("edge cases not yet handled", () => {
		test.skip("repeated sections with inline comments", () => {
			const repeated_with_comments = `X:1
T:Repeated Section
M:4/4
L:1/8
K:D
|: D2 FA dA FD | % A part bar 1
G2 Bc d2 cB :| % A part bar 2
|: A2 AB c2 BA | % B part bar 1
G2 FE D4 :| % B part bar 2`;

			const transformed = toggleMeter_4_4_to_4_2(repeated_with_comments);
			const restored = toggleMeter_4_4_to_4_2(transformed);

			// KNOWN ISSUE: Repeat signs combined with inline comments
			// create additional complexity in bar line tracking
			expect(restored).toBe(repeated_with_comments);
		});
	});
});
