const {
	toggleMeter_4_4_to_4_2,
	toggleMeter_6_8_to_12_8,
	getFirstBars,
	hasAnacrucis
} = require("../src/index.js");

describe("ABC Manipulator - Inverse Operations", () => {
	describe("4/4 to 4/2 toggles", () => {
		test("simple 4/4 to 4/2 inverse", () => {
			const simple_4_4 = `X:1
T:Simple Test
M:4/4
L:1/8
K:D
D2 FA dA FD | G2 Bc d2 cB |
A2 AB c2 BA | G2 FE D4 |]`;

			const transformed = toggleMeter_4_4_to_4_2(simple_4_4);
			const restored = toggleMeter_4_4_to_4_2(transformed);

			expect(restored).toBe(simple_4_4);
		});

		test("4/4 with varied spacing inverse; one space added after toggled bar lines", () => {
			const varied_spacing = `X:1
T:Varied Spacing
M:4/4
L:1/8
K:D
D2FA dAFD  |G2 Bc   d2cB|
A2 AB c2 BA| G2FE D4 |
D2FA dAFD  |  G2 Bc   d2cB|
A2 AB c2 BA|   G2FE D4 |
D2FA dAFD  |      G2 Bc   d2cB|
A2 AB c2 BA| G2FE D4|]`;
			const expected = `X:1
T:Varied Spacing
M:4/4
L:1/8
K:D
D2FA dAFD  | G2 Bc   d2cB|
A2 AB c2 BA | G2FE D4 |
D2FA dAFD  | G2 Bc   d2cB|
A2 AB c2 BA | G2FE D4 |
D2FA dAFD  | G2 Bc   d2cB|
A2 AB c2 BA | G2FE D4|]`;

			const transformed = toggleMeter_4_4_to_4_2(varied_spacing);
			const restored = toggleMeter_4_4_to_4_2(transformed);

			expect(restored).toBe(expected);
		});

		test("4/4 with anacrusis inverse", () => {
			const with_anacrusis = `X:1
T:With Anacrusis
M:4/4
L:1/8
K:D
FA | d2 cB A2 FA | d2 f2 e2 d2 |
c2 BA G2 FE | D4 D4 |]`;

			const transformed = toggleMeter_4_4_to_4_2(with_anacrusis);
			const restored = toggleMeter_4_4_to_4_2(transformed);

			expect(restored).toBe(with_anacrusis);
		});

		test("starting from 4/2", () => {
			const start_4_2 = `X:1
T:Starting from 4/2
M:4/2
L:1/8
K:D
D2 FA dA FD G2 Bc d2 cB |A2 AB c2 BA G2 FE D4 |]`;

			const transformed = toggleMeter_4_4_to_4_2(start_4_2);
			const restored = toggleMeter_4_4_to_4_2(transformed);

			expect(restored).toBe(start_4_2);
		});

		test("starting from 4/2 with anacrusis", () => {
			const start_4_2_anacrusis = `X:1
T:4/2 with Anacrusis
M:4/2
L:1/8
K:D
FA | d2 cB A2 FA d2 f2 e2 d2 |c2 BA G2 FE D4 D4 |]`;

			const transformed = toggleMeter_4_4_to_4_2(start_4_2_anacrusis);
			const restored = toggleMeter_4_4_to_4_2(transformed);

			expect(restored).toBe(start_4_2_anacrusis);
		});
	});

	describe("6/8 to 12/8 toggles", () => {
		test("simple 6/8 to 12/8 inverse", () => {
			const simple_6_8 = `X:1
T:Simple Jig
M:6/8
L:1/8
K:D
DFA dAF | GBd gdB |
AFD DFA | G2E E3 |]`;

			const transformed = toggleMeter_6_8_to_12_8(simple_6_8);
			const restored = toggleMeter_6_8_to_12_8(transformed);

			expect(restored).toBe(simple_6_8);
		});

		test("6/8 with triplets and ornaments inverse", () => {
			const complex_6_8 = `X:1
T:Complex Jig
M:6/8
L:1/8
K:G
~D3 EFG | ABc d2e |
A(3fed cBA | G3 G3 |]`;

			const transformed = toggleMeter_6_8_to_12_8(complex_6_8);
			const restored = toggleMeter_6_8_to_12_8(transformed);

			expect(restored).toBe(complex_6_8);
		});

		test("starting from 12/8 260215", () => {
			//this looks like a good failing test to look at
			const start_12_8 = `X:1
T:Starting from 12/8
M:12/8
L:1/8
K:D
DFA dAF GBd gdB |AFD DFA G2E E3 |]`;

			const transformed = toggleMeter_6_8_to_12_8(start_12_8);
			// console.log(transformed);
			const restored = toggleMeter_6_8_to_12_8(transformed);
			expect(restored).toBe(start_12_8);
		});

		test("6/8 with anacrusis inverse", () => {
			const with_anacrusis = `X:1
T:Jig with Anacrusis
M:6/8
L:1/8
K:D
FA | DFA dAF | GBd gdB |
AFD DFA | G2E E3 |]`;

			const transformed = toggleMeter_6_8_to_12_8(with_anacrusis);
			const restored = toggleMeter_6_8_to_12_8(transformed);

			expect(restored).toBe(with_anacrusis);
		});

		test("starting from 12/8 with anacrusis", () => {
			const start_12_8_anacrusis = `X:1
T:12/8 with Anacrusis
M:12/8
L:1/8
K:D
FA | DFA dAF GBd gdB |AFD DFA G2E E3 |]`;

			const transformed = toggleMeter_6_8_to_12_8(start_12_8_anacrusis);
			const restored = toggleMeter_6_8_to_12_8(transformed);

			expect(restored).toBe(start_12_8_anacrusis);
		});
	});
});

describe("ABC Manipulator - getFirstBars", () => {
	describe("basic functionality", () => {
		test("get first bar without anacrusis", () => {
			const abc = `X:1
T:Example Tune
M:4/4
L:1/8
K:D
FA | d2 cB A2 FA | d2 f2 e2 d2 |`;

			const result = getFirstBars(abc, 1);

			expect(result).toContain("X:1");
			expect(result).toContain("T:Example Tune");
			expect(result).toContain("d2 cB A2 FA");
			expect(result).not.toContain("| d2 f2 e2 d2 |");
		});

		test("get first two bars with anacrusis", () => {
			const abc = `X:1
T:Example Tune
M:4/4
L:1/8
K:D
FA | d2 cB A2 FA | d2 f2 e2 d2 | eeee`;

			const result = getFirstBars(abc, 2);

			expect(result).toContain("d2 cB A2 FA |");
			expect(result).toContain("| d2 f2 e2 d2 |");
			expect(result).not.toContain("eeee");
		});

		test("get first bar preserving comments", () => {
			const abc = `X:1
T:With Comments
M:4/4
L:1/8
K:D
FA | d2 cB A2 FA | % first complete bar
d2 f2 e2 d2 | % second bar
c2 BA G2 FE |`;

			expect(() => getFirstBars(abc, 1)).not.toThrow();
			const result = getFirstBars(abc, 1);
			expect(result).toBeDefined();
		});

		test("get first bar preserving spacing", () => {
			const abc = `X:1
T:Varied Spacing
M:4/4
L:1/8
K:D
FA|d2cB A2FA|d2 f2   e2d2|`;

			expect(() => getFirstBars(abc, 1)).not.toThrow();
			const result = getFirstBars(abc, 1);
			expect(result).toBeDefined();
		});

		test("get first three bars from longer tune", () => {
			const abc = `X:1
T:Longer Tune
M:4/4
L:1/8
K:D
D2 FA dA FD | G2 Bc d2 cB |
A2 AB c2 BA | G2 FE D4 |
d2 fd e2 ce | B2 GB A4 |]`;

			const result = getFirstBars(abc, 3);

			expect(result).toContain("D2 FA dA FD |");
			expect(result).toContain("G2 Bc d2 cB |");
			expect(result).toContain("A2 AB c2 BA |");
			expect(result).not.toContain("G2 FE D4 |");
		});

		test("get first bar from 6/8", () => {
			const abc = `X:1
T:Jig
M:6/8
L:1/8
K:D
DFA dAF | GBd gdB |
AFD DFA | G2E E3 |]`;

			const result = getFirstBars(abc, 1);

			expect(result.trim()).toContain("DFA dAF");
			expect(result).not.toContain("GBd gdB |");
		});

		test("no anacrusis (first bar is already complete)", () => {
			const abc = `X:1
T:No Pickup
M:4/4
L:1/8
K:D
D2 FA dA FD | G2 Bc d2 cB |]`;

			const result = getFirstBars(abc, 1);

			expect(result.trim()).toContain("D2 FA dA FD");
			expect(result).not.toContain("G2 Bc d2 cB |");
		});
	});

	describe("with anacrusis parameter", () => {
		test("get first bar including anacrusis", () => {
			const abc = `X:1
T:Example Tune
M:4/4
L:1/8
K:D
FA | d2 cB A2 FA | d2 f2 e2 d2 |`;

			const result = getFirstBars(abc, 1, true);

			expect(result).toContain("FA |");
			expect(result).toContain("d2 cB A2 FA");
			expect(result).not.toContain("| d2 f2 e2 d2 |");
		});

		test("get first bar excluding anacrusis", () => {
			const abc = `X:1
T:Example Tune
M:4/4
L:1/8
K:D
FA | d2 cB A2 FA | d2 f2 e2 d2 |`;

			const result = getFirstBars(abc, 1, false);

			expect(result).not.toContain("K:D\nFA |");
			expect(result).toContain("K:D\nd2 cB A2 FA");
			expect(result).not.toContain("| d2 f2 e2 d2 |");
		});

		test("get first two bars including anacrusis", () => {
			const abc = `X:1
T:Example Tune
M:4/4
L:1/8
K:D
FA | d2 cB A2 FA | d2 f2 e2 d2 | c2 BA G2 FE |`;

			const result = getFirstBars(abc, 2, true);

			expect(result).toContain("FA |");
			expect(result).toContain("d2 cB A2 FA |");
			expect(result).toContain("| d2 f2 e2 d2 |");
			expect(result).not.toContain("c2 BA G2 FE");
		});

		test("no anacrusis - withAnacrucis parameter has no effect", () => {
			const abc = `X:1
T:No Pickup
M:4/4
L:1/8
K:D
D2 FA dA FD | G2 Bc d2 cB | A2 AB c2 BA |]`;

			const resultWithout = getFirstBars(abc, 1, false);
			const resultWith = getFirstBars(abc, 1, true);

			expect(resultWithout).toBe(resultWith);
			expect(resultWith).toContain("D2 FA dA FD");
			expect(resultWith).not.toContain("G2 Bc d2 cB");
		});

		test("get first bar from 6/8 including anacrusis", () => {
			const abc = `X:1
T:Jig
M:6/8
L:1/8
K:D
FA | DFA dAF | GBd gdB |]`;

			const result = getFirstBars(abc, 1, true);

			expect(result).toContain("FA |");
			expect(result).toContain("DFA dAF");
			expect(result).not.toContain("GBd gdB");
		});
	});
});

describe("ABC Manipulator - hasAnacrucis", () => {
	test("detects anacrusis in 4/4", () => {
		const abc = `X:1
T:With Anacrusis
M:4/4
L:1/8
K:D
FA | d2 cB A2 FA | d2 f2 e2 d2 |`;

		expect(hasAnacrucis(abc)).toBe(true);
	});

	test("detects no anacrusis in 4/4", () => {
		const abc = `X:1
T:No Pickup
M:4/4
L:1/8
K:D
D2 FA dA FD | G2 Bc d2 cB |]`;

		expect(hasAnacrucis(abc)).toBe(false);
	});

	test("detects anacrusis in 6/8", () => {
		const abc = `X:1
T:Jig with Pickup
M:6/8
L:1/8
K:D
FA | DFA dAF | GBd gdB |]`;

		expect(hasAnacrucis(abc)).toBe(true);
	});

	test("detects no anacrusis in 6/8", () => {
		const abc = `X:1
T:Jig
M:6/8
L:1/8
K:D
DFA dAF | GBd gdB |]`;

		expect(hasAnacrucis(abc)).toBe(false);
	});

	test("detects anacrusis in 4/2", () => {
		const abc = `X:1
T:4/2 with Pickup
M:4/2
L:1/8
K:D
FA | d2 cB A2 FA d2 f2 e2 d2 |]`;

		expect(hasAnacrucis(abc)).toBe(true);
	});

	test("detects no anacrusis in 12/8", () => {
		const abc = `X:1
T:12/8 tune
M:12/8
L:1/8
K:D
DFA dAF GBd gdB |AFD DFA G2E E3 |]`;

		expect(hasAnacrucis(abc)).toBe(false);
	});
});
