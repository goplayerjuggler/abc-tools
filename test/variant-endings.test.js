const { parseAbc } = require("../src/parse/parser");

describe("parse first & second repeats", () => {
	test("handles [1 syntax inside bars", () => {
		const abc = `X:1
L:1/4
M:2/4
K: D 
CC|D [1E:| [2G|]
F2|]
`;

		const result = parseAbc(abc);
		const variant1 = result.bars[1][1], //2nd token of 2nd bar
			variant2 = result.bars[2][0]; //1st token of 3rd "bar"
		expect(result.bars.length).toBe(3);
		expect(variant1.isVariantEnding).toBe(true);
		expect(variant2.isVariantEnding).toBe(true);
	});
	test("handles |1 syntax", () => {
		const abc = `X:1
L:1/4
M:2/4
K: D 
CC|1DE:|2DG|]
`;

		const result = parseAbc(abc);
		const variant1 = result.bars[1][0],
			variant2 = result.bars[2][0];
		expect(result.bars.length).toBe(3);
		expect(variant1.isVariantEnding).toBe(true);
		expect(variant2.isVariantEnding).toBe(true);
	});

	test("handles [1 syntax at start of bars", () => {
		const abc = `X:1
L:1/4
M:2/4
K: D 
CC|[1DE:|[2DG|]
`;

		const result = parseAbc(abc);
		const variant1 = result.bars[1][0],
			variant2 = result.bars[2][0];
		expect(result.bars.length).toBe(3);
		expect(variant1.isVariantEnding).toBe(true);
		expect(variant2.isVariantEnding).toBe(true);
	});
});
