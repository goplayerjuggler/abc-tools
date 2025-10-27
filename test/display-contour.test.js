const { positionToString } = require("../src/sort/display-contour");
// Jest tests
describe("positionToString", () => {
	describe("base octave (0-6)", () => {
		test('position 0 returns "1"', () => {
			expect(positionToString(0)).toBe("1");
		});

		test('position 1 returns "2"', () => {
			expect(positionToString(1)).toBe("2");
		});

		test('position 6 returns "7"', () => {
			expect(positionToString(6)).toBe("7");
		});
	});

	describe("first octave up (7-13)", () => {
		test('position 7 returns "1\'"', () => {
			expect(positionToString(7)).toBe("1'");
		});

		test('position 8 returns "2\'"', () => {
			expect(positionToString(8)).toBe("2'");
		});

		test('position 13 returns "7\'"', () => {
			expect(positionToString(13)).toBe("7'");
		});
	});

	describe("second octave up (14-20)", () => {
		test("position 14 returns \"1''\"", () => {
			expect(positionToString(14)).toBe("1''");
		});

		test("position 20 returns \"7''\"", () => {
			expect(positionToString(20)).toBe("7''");
		});
	});

	describe("first octave down (-7 to -1)", () => {
		test('position -1 returns "7,"', () => {
			expect(positionToString(-1)).toBe("7,");
		});

		test('position -2 returns "6,"', () => {
			expect(positionToString(-2)).toBe("6,");
		});

		test('position -7 returns "1,"', () => {
			expect(positionToString(-7)).toBe("1,");
		});
	});

	describe("second octave down (-14 to -8)", () => {
		test('position -8 returns "7,,"', () => {
			expect(positionToString(-8)).toBe("7,,");
		});

		test('position -9 returns "6,,"', () => {
			expect(positionToString(-9)).toBe("6,,");
		});

		test('position -14 returns "1,,"', () => {
			expect(positionToString(-14)).toBe("1,,");
		});
	});

	describe("edge cases", () => {
		test("position 21 returns \"1'''\"", () => {
			expect(positionToString(21)).toBe("1'''");
		});

		test('position -15 returns "7,,,"', () => {
			expect(positionToString(-15)).toBe("7,,,");
		});
	});
});
