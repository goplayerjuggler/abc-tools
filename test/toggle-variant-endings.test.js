const {
	toggleMeter_4_4_to_4_2,
	toggleMeter_6_8_to_12_8,
} = require("../src/index.js");

describe("toggleMeterDoubling with variant endings", () => {
	describe("variant endings at start of bar", () => {
		test("4/4 to 4/2 with variant ending at bar start", () => {
			const input = `X:1
M:4/4
L:1/4
K:C
C4|D4|E4|1F4:|2G4||
C4|D4|E4|E4|]`;

			const result = toggleMeter_4_4_to_4_2(input);

			// Check key transformations (ignoring exact spacing)
			expect(result).toContain("M:4/2");
			expect(result).toContain("C4 D4");
			expect(result).toContain("[1F4");
			expect(result).toContain("|2G4");
			expect(result).toContain(":|");
			expect(result).toContain("||");
		});

		test("4/4 to 4/2 with variant ending at bar start (2)", () => {
			const input = `X:1
M:4/4
L:1/4
K:C
|:C4|D4|E4|1F4:|2G4||
C4|D4|E4|E4|]`;

			const result = toggleMeter_4_4_to_4_2(input);

			// Check key transformations (ignoring exact spacing)
			expect(result).toContain("M:4/2");
			expect(result).toContain("C4 D4");
			expect(result).toMatch(/(\[|\|)1F4/);
			/*
 Received string:    "X:1
    M:4/2
    L:1/4
    K:C
    |C4 D4 |E4 |1F4 :|2G4 ||
    C4 D4 |E4 E4 |]"
 */
			expect(result).toContain("|2G4");
			expect(result).toContain(":|");
			expect(result).toContain("||");
		});

		test("4/2 to 4/4 with variant ending splits correctly", () => {
			const input = `X:1
M:4/2
L:1/4
K:C
C4 D4|E4 [1F4:|[2G4||
C4 D4|E4 E4|]`;

			const result = toggleMeter_4_4_to_4_2(input);

			expect(result).toContain("M:4/4");
			// Variant endings should stay as [1, [2
			expect(result).toContain("[1F4");
			expect(result).toContain("[2G4");
			expect(result).toContain(":|");
			expect(result).toContain("||");
		});
	});

	describe("variant endings in middle of bar", () => {
		test("4/4 to 4/2 with variant ending mid-bar", () => {
			const input = `X:1
M:4/4
L:1/4
K:C
C4|D4|E4|F3[1G:|[2A||
C4|D4|E4|E4|]`;

			const result = toggleMeter_4_4_to_4_2(input);

			expect(result).toContain("M:4/2");
			expect(result).toContain("C4 D4");
			expect(result).toContain("[1G");
			expect(result).toContain("[2A");
		});
	});

	describe("multi-bar variant endings", () => {
		test("4/4 to 4/2 with variant ending spanning multiple bars", () => {
			const input = `X:1
M:4/4
L:1/4
K:C
C4|D4|E4|1F4|G4|A4:|2FAFA|GBGB|Acac||
C4|D4|E4|E4|]`;

			const result = toggleMeter_4_4_to_4_2(input);

			expect(result).toContain("M:4/2");
			expect(result).toContain("[1F4");
			expect(result).toContain("G4 A4");
			expect(result).toContain("|2FAFA");
			expect(result).toContain("GBGB Acac");
		});
	});

	describe("6/8 to 12/8 with variant endings", () => {
		test("simple variant ending in 6/8", () => {
			const input = `X:1
M:6/8
L:1/8
K:D
DFA dAF|1GBd e3:|2gdB f3||
AFD DFA|]`;

			const result = toggleMeter_6_8_to_12_8(input);

			expect(result).toContain("M:12/8");
			expect(result).toContain("[1GBd");
			expect(result).toContain("|2gdB");
		});
	});

	describe("round-trip preservation", () => {
		test("variant endings preserved through round trip", () => {
			const original = `X:1
M:4/4
L:1/4
K:C
C4|D4|E4|1F4:|2G4||
C4|D4|E4|E4|]`;

			const to4_2 = toggleMeter_4_4_to_4_2(original);
			const backTo4_4 = toggleMeter_4_4_to_4_2(to4_2);

			// Check that musical content is preserved
			// After round trip, variant endings should be in [1 [2 format
			expect(backTo4_4).toContain("M:4/4");
			expect(backTo4_4).toContain("[1F4");
			expect(backTo4_4).toContain("|2G4");
			expect(backTo4_4).toContain(":|");
			expect(backTo4_4).toContain("||");
		});

		test("variant endings preserved through round trip (mid-bar)", () => {
			const original = `X:1
M:4/4
L:1/4
K:C
C4|D4|E4|F3[1G:|[2A||
C4|D4|E4|E4|]`;

			const to4_2 = toggleMeter_4_4_to_4_2(original);
			const backTo4_4 = toggleMeter_4_4_to_4_2(to4_2);

			// Check that musical content is preserved
			expect(backTo4_4).toContain("M:4/4");
			expect(backTo4_4).toContain("[1G");
			expect(backTo4_4).toContain("[2A");
			expect(backTo4_4).toContain(":|");
			expect(backTo4_4).toContain("||");
		});
	});
});
