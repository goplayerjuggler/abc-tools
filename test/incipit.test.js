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
});
