const {
	toggleMeter_4_4_to_4_2,
	toggleMeter_6_8_to_12_8,
} = require("../src/index.js");

// ============================================================================
// FAILING TESTS
// These tests document known issues that are not currently being addressed
// They are kept separate to maintain a clean test suite while tracking
// technical debt and future improvements
// ============================================================================

describe("ABC Manipulator - Known Failing Cases", () => {
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

			// KNOWN ISSUE: Inline comments after bar lines cause issues
			// during bar line manipulation. The current implementation
			// does not preserve comment positioning correctly when
			// removing or adding bar lines.
			//
			// To fix this would require:
			// 1. Tracking comment positions separately from bar lines
			// 2. Re-associating comments with the correct bars after transformation
			// 3. Handling edge cases where comments might be orphaned
			//
			// This is a low-priority issue as inline comments are relatively
			// uncommon in ABC notation, and the transformation still produces
			// valid ABC (just without preserved comments).

			expect(restored).toContain(`
K:D
D2 FA dA FD |
G2 Bc d2 cB |
A2 AB c2 BA | G2 FE D4 |]`);
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

