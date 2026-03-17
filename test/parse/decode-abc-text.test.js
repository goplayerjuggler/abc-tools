const {
	decodeABCText,
	stripComment
} = require("../../src/parse/decode-abc-text");
const { getHeaderValues } = require("../../src/parse//header-parser");

describe("stripComment", () => {
	it("strips % comment and trailing whitespace", () =>
		expect(stripComment("My Tune  %a comment")).toBe("My Tune"));
	it("preserves \\% as a literal percent sign", () =>
		expect(stripComment("P\\%Q %comment")).toBe("P\\%Q"));
});

describe("decodeABCText", () => {
	it("acute: \\'e → é", () => expect(decodeABCText("\\'e")).toBe("é"));
	it('umlaut: \\"o → ö', () => expect(decodeABCText('\\"o')).toBe("ö"));
	it("cedilla: \\cc → ç", () => expect(decodeABCText("\\cc")).toBe("ç"));
	it("ring: \\aa → å", () => expect(decodeABCText("\\aa")).toBe("å"));
	it("caron: \\vs → š", () => expect(decodeABCText("\\vs")).toBe("š"));
	it("ligature: \\AE → Æ", () => expect(decodeABCText("\\AE")).toBe("Æ"));
	it("breve: \\uA → Ă (not confused with \\uXXXX)", () =>
		expect(decodeABCText("\\uA")).toBe("Ă"));
	it("\\uXXXX fixed-width unicode", () =>
		expect(decodeABCText("\\u00E9")).toBe("é"));
	it("\\\\ → single backslash", () => expect(decodeABCText("\\\\")).toBe("\\"));
	it("\\% → literal percent", () => expect(decodeABCText("\\%")).toBe("%"));
	it("named HTML entity &eacute;", () =>
		expect(decodeABCText("&eacute;")).toBe("é"));
	it("numeric HTML entity &#233;", () =>
		expect(decodeABCText("&#233;")).toBe("é"));
	it("curly brace with backslash {\\\\aa}", () =>
		expect(decodeABCText("{\\aa}")).toBe("å"));
	it("curly brace without backslash {aa}", () =>
		expect(decodeABCText("{aa}")).toBe("å"));
	it('real-world Norbeck: G\\"ardebyl{\\aa}ten', () =>
		expect(decodeABCText('G\\"ardebyl{\\aa}ten')).toBe("Gärdebylåten"));
	it("unknown escape left unchanged", () =>
		expect(decodeABCText("\\zz")).toBe("\\zz"));
});

describe("getHeaderValues", () => {
	it("returns all T: values, decoded", () => {
		const abc = "T:Title One\nT:Caf\\'e\nK:C";
		expect(getHeaderValues(abc, "T")).toEqual(["Title One", "Café"]);
	});
	it("returns empty array when header absent", () =>
		expect(getHeaderValues("K:C", "T")).toEqual([]));
	it("strips inline comment from value", () =>
		expect(getHeaderValues("T:My Tune %ignore\nK:C", "T")).toEqual([
			"My Tune"
		]));
	it("decode:false returns raw comment-stripped value", () =>
		expect(getHeaderValues("T:Caf\\'e\nK:C", "T", { decode: false })).toEqual([
			"Caf\\'e"
		]));
});
