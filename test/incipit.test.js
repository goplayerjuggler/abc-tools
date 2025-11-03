const {
	getIncipit,
	getIncipitForContourGeneration,
} = require("../src/index.js");

describe("getIncipit", () => {
	test("Missing L - assumes 1/8", () => {
		const abc = `X:44
T:Musical Priest, The
R:reel
M:C|
K:Bm
FBBA BcdB|cBAf ecBA|FBBA BcdB|
|:dB~B2 bafb|
`;
		let result = getIncipit(abc, 1);
		expect(result).toContain("FBBA BcdB");
		result = getIncipitForContourGeneration(abc);
		expect(result).toContain("FBBA BcdB");
	});
	const abcMeter = `X:1
T:A Tune For Frankie
C:Mairéad Ní Mhaonaigh
R:jig
L:1/8
M:6/8
K:Gdorian
|: D2 G FDC | ~A,3 F3 | ~A,3 C3 | [M:9/8] A,CA, G,A,G, G,GF | 
 `;
	test("Meter change - 1", () => {
		let result = getIncipit(abcMeter, 1);
		expect(result).toContain("D2 G FDC");

		result = getIncipitForContourGeneration(abcMeter);
		expect(result).toContain("D2 G FDC");
	});
	test.skip("Meter change - 2 - 4 bars", () => {
		const result = getIncipit(abcMeter, 4);
		expect(result).toContain("G,GF");
	});
});
