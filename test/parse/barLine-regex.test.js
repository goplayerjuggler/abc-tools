const { getTokenRegex } = require("../../src/parse/token-utils");

describe("Bar line regex", () => {
	const barLineRegex = getTokenRegex({ barLine: true });

	describe("Basic bar lines", () => {
		test("matches simple bar line", () => {
			const match = "|".match(barLineRegex);
			expect(match).not.toBeNull();
			expect(match[0]).toBe("|");
		});

		test("matches double bar line", () => {
			const match = "||".match(barLineRegex);
			expect(match).not.toBeNull();
			expect(match[0]).toBe("||");
		});

		test("matches thick bar line variations", () => {
			expect("|]".match(barLineRegex)[0]).toBe("|]");
			expect("[|".match(barLineRegex)[0]).toBe("[|");
			expect("[|]".match(barLineRegex)[0]).toBe("[|]");
		});

		test("matches bar line with trailing spaces", () => {
			const match = "|  ".match(barLineRegex);
			expect(match).not.toBeNull();
			expect(match[0]).toBe("|  ");
		});

		test("matches dotted bar line", () => {
			const match = ".|".match(barLineRegex);
			expect(match).not.toBeNull();
			expect(match[0]).toBe(".|");
		});
	});

	describe("Repeat bar lines", () => {
		test("matches repeat start", () => {
			const match = "|:".match(barLineRegex);
			expect(match).not.toBeNull();
			expect(match[0]).toBe("|:");
		});

		test("matches repeat end", () => {
			const match = ":|".match(barLineRegex);
			expect(match).not.toBeNull();
			expect(match[0]).toBe(":|");
		});

		test("matches double repeat", () => {
			const match = ":||:".match(barLineRegex);
			expect(match).not.toBeNull();
			expect(match[0]).toBe(":||:");
		});

		test("matches alternate double repeat", () => {
			const match = ":|:".match(barLineRegex);
			expect(match).not.toBeNull();
			expect(match[0]).toBe(":|:");
		});

		test("matches double colon", () => {
			const match = "::".match(barLineRegex);
			expect(match).not.toBeNull();
			expect(match[0]).toBe("::");
		});

		test("matches complex repeat with brackets", () => {
			const match = ":|]".match(barLineRegex);
			expect(match).not.toBeNull();
			expect(match[0]).toBe(":|]");
		});
	});

	describe("Valid [|] sequences", () => {
		test("matches [| at start of bar line", () => {
			const match = "[|".match(barLineRegex);
			expect(match).not.toBeNull();
			expect(match[0]).toBe("[|");
		});

		test("matches |[| sequence when [ is not followed by field/digit", () => {
			const match = "|[|]".match(barLineRegex);
			expect(match).not.toBeNull();
			expect(match[0]).toBe("|[|]");
		});

		test("matches complex bar line [|::", () => {
			const match = "[|::".match(barLineRegex);
			expect(match).not.toBeNull();
			expect(match[0]).toBe("[|::");
		});
	});

	describe("Edge cases", () => {
		test("matches bar line with leading colons", () => {
			const match = "::|".match(barLineRegex);
			expect(match).not.toBeNull();
			expect(match[0]).toBe("::|");
		});

		test("matches bar line with leading dots", () => {
			const match = "..|".match(barLineRegex);
			expect(match).not.toBeNull();
			expect(match[0]).toBe("..|");
		});

		test("matches liberal bar line |[|", () => {
			const match = "|[|".match(barLineRegex);
			expect(match).not.toBeNull();
			expect(match[0]).toBe("|[|");
		});

		test("does not match standalone [", () => {
			const match = "[".match(barLineRegex);
			expect(match).toBeNull();
		});

		test("does not match inline field without bar line", () => {
			const match = "[K:G]".match(barLineRegex);
			expect(match).toBeNull();
		});

		test("does not match variant ending without bar line", () => {
			const match = "[1".match(barLineRegex);
			expect(match).toBeNull();
		});
	});

	describe("Full token regex integration", () => {
		const fullRegex = getTokenRegex();

		test("tokenises bar line followed by inline field correctly", () => {
			const input = "C4|[M:3/4]D3";
			const tokens = [...input.matchAll(fullRegex)];

			expect(tokens.length).toBeGreaterThanOrEqual(3);
			expect(tokens[1][0]).toBe("|");
			expect(tokens[2][0]).toBe("[M:3/4]");
		});

		test("tokenises bar line followed by variant ending correctly", () => {
			const input = "C4|[1 D4 :|[2 E4 |]";
			const tokens = [...input.matchAll(fullRegex)];

			const barLineIndices = tokens
				.map((t, i) => ({ token: t[0], index: i }))
				.filter((t) => t.token.match(barLineRegex));

			expect(barLineIndices[0].token).toBe("|");
			expect(barLineIndices[1].token).toBe(":|");
			expect(barLineIndices[2].token).toBe("|]");
		});

		test("tokenises repeat bar line with trailing colon correctly", () => {
			const input = "G3A[P:A] |: B3c";
			const tokens = [...input.matchAll(fullRegex)];

			const barLine = tokens.find((t) => t[0].match(barLineRegex));
			expect(barLine[0]).toBe("|: ");
		});
		describe("Bar line followed by inline fields", () => {
			test("does not capture [ when followed by K: inline field", () => {
				const tokens = [..."|[K:G]".matchAll(fullRegex)];
				expect(tokens[0]).not.toBeNull();
				expect(tokens[0][0]).toBe("|");
			});

			test("does not capture [ when followed by L: inline field", () => {
				const tokens = [..."|[L:1/8]".matchAll(fullRegex)];
				expect(tokens[0]).not.toBeNull();
				expect(tokens[0][0]).toBe("|");
			});

			test("does not capture [ when followed by M: inline field", () => {
				const tokens = [..."|[M:3/4]".matchAll(fullRegex)];
				expect(tokens[0]).not.toBeNull();
				expect(tokens[0][0]).toBe("|");
			});

			test("does not capture [ when followed by P: inline field", () => {
				const tokens = [..."|[P:A]".matchAll(fullRegex)];
				expect(tokens[0]).not.toBeNull();
				expect(tokens[0][0]).toBe("|");
			});

			test("matches bar line with repeat before inline field", () => {
				const tokens = [...":|[K:D]".matchAll(fullRegex)];
				expect(tokens[0]).not.toBeNull();
				expect(tokens[0][0]).toBe(":|");
			});

			test("handles inline field in context", () => {
				const input = "G3A[P:A] |: A";
				const tokens = [...input.matchAll(fullRegex)];
				expect(tokens[3]).not.toBeNull();
				expect(tokens[3][0].trim()).toBe("|:");
			});
		});

		describe("Bar line followed by variant endings", () => {
			test("does not capture [ when followed by variant ending [1", () => {
				const tokens = [..."|[1".matchAll(fullRegex)];
				expect(tokens[0]).not.toBeNull();
				expect(tokens[0][0]).toBe("|");
			});

			test("does not capture [ when followed by variant ending [2", () => {
				const tokens = [..."|[2".matchAll(fullRegex)];
				expect(tokens[0]).not.toBeNull();
				expect(tokens[0][0]).toBe("|");
			});

			test("does not capture [ when followed by range variant [1-3", () => {
				const tokens = [...":|[1-3".matchAll(fullRegex)];
				expect(tokens[0]).not.toBeNull();
				expect(tokens[0][0]).toBe(":|");
			});

			test("does not capture [ when followed by complex variant [1-3,5-7", () => {
				const tokens = [..."|[1-3,5-7".matchAll(fullRegex)];
				expect(tokens[0]).not.toBeNull();
				expect(tokens[0][0]).toBe("|");
			});
		});
	});
});
