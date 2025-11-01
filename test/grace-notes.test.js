const { parseAbc } = require("../src/parse/parser");
const { parseGraceNotes } = require("../src/parse/note-parser");
const { Fraction } = require("../src/math");

describe("grace notes", () => {
	describe("parseGraceNotes", () => {
		test("parses simple grace notes", () => {
			const result = parseGraceNotes("{AB}");
			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({
				pitch: "A",
				octave: 0,
				isGraceNote: true,
				duration: new Fraction(0, 1),
			});
			expect(result[1]).toMatchObject({
				pitch: "B",
				octave: 0,
				isGraceNote: true,
				duration: new Fraction(0, 1),
			});
		});

		test("parses grace notes with accidentals", () => {
			const result = parseGraceNotes("{^A_B}");
			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({
				pitch: "A",
				octave: 0,
				isGraceNote: true,
			});
			expect(result[1]).toMatchObject({
				pitch: "B",
				octave: 0,
				isGraceNote: true,
			});
		});

		test("parses grace notes with octave markers", () => {
			const result = parseGraceNotes("{A'B,}");
			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({
				pitch: "A",
				octave: 1,
				isGraceNote: true,
			});
			expect(result[1]).toMatchObject({
				pitch: "B",
				octave: -1,
				isGraceNote: true,
			});
		});

		test("parses grace notes with chords", () => {
			const result = parseGraceNotes("{[CEG]A}");
			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({
				pitch: "G", // topmost note of chord
				isGraceNote: true,
				isChord: true,
			});
			expect(result[0].chordNotes).toHaveLength(3);
			expect(result[1]).toMatchObject({
				pitch: "A",
				isGraceNote: true,
			});
		});

		test("ignores duration modifiers in grace notes", () => {
			const result = parseGraceNotes("{A2B/2}");
			expect(result).toHaveLength(2);
			// Both should have zero duration regardless of modifiers
			expect(result[0].duration).toEqual(new Fraction(0, 1));
			expect(result[1].duration).toEqual(new Fraction(0, 1));
		});

		test("returns null for invalid input", () => {
			expect(parseGraceNotes("ABC")).toBeNull();
			expect(parseGraceNotes("{}")).toBeNull();
			expect(parseGraceNotes("{")).toBeNull();
		});
	});

	describe("grace notes in parseAbc", () => {
		test("parses tune with grace notes", () => {
			const abc = "X:1\nL:1/8\nK:D\n{AB}c2|";
			const result = parseAbc(abc);

			expect(result.bars).toHaveLength(1);
			expect(result.bars[0]).toHaveLength(3);

			// Grace notes
			expect(result.bars[0][0]).toMatchObject({
				pitch: "A",
				isGraceNote: true,
				duration: new Fraction(0, 1),
			});
			expect(result.bars[0][1]).toMatchObject({
				pitch: "B",
				isGraceNote: true,
				duration: new Fraction(0, 1),
			});

			// Regular note
			expect(result.bars[0][2]).toMatchObject({
				pitch: "c",
				duration: new Fraction(1, 4),
			});
			expect(result.bars[0][2].isGraceNote).toBeUndefined();
		});

		test("grace notes are transparent to broken rhythms", () => {
			const abc = "X:1\nL:1/8\nK:D\nA{Bc}>d|";
			const result = parseAbc(abc);

			expect(result.bars).toHaveLength(1);
			const bar = result.bars[0];

			// Find the real notes (not grace notes, not broken rhythm marker)
			const realNotes = bar.filter((n) => n.pitch && !n.isGraceNote);
			expect(realNotes).toHaveLength(2);

			// A should be lengthened (3/16 from 1/8)
			expect(realNotes[0].pitch).toBe("A");
			expect(realNotes[0].duration).toEqual(new Fraction(3, 16));

			// d should be shortened (1/16 from 1/8)
			expect(realNotes[1].pitch).toBe("d");
			expect(realNotes[1].duration).toEqual(new Fraction(1, 16));

			// Grace notes should be present with zero duration
			const graceNotes = bar.filter((n) => n.isGraceNote);
			expect(graceNotes).toHaveLength(2);
			expect(graceNotes[0].pitch).toBe("B");
			expect(graceNotes[1].pitch).toBe("c");
			graceNotes.forEach((note) => {
				expect(note.duration).toEqual(new Fraction(0, 1));
			});
		});

		test("grace notes with broken rhythm in other direction", () => {
			const abc = "X:1\nL:1/8\nK:D\nA{Bc}<d|";
			const result = parseAbc(abc);

			const bar = result.bars[0];
			const realNotes = bar.filter((n) => n.pitch && !n.isGraceNote);

			// A should be shortened (1/16 from 1/8)
			expect(realNotes[0].pitch).toBe("A");
			expect(realNotes[0].duration).toEqual(new Fraction(1, 16));

			// d should be lengthened (3/16 from 1/8)
			expect(realNotes[1].pitch).toBe("d");
			expect(realNotes[1].duration).toEqual(new Fraction(3, 16));
		});

		test("multiple grace note groups", () => {
			const abc = "X:1\nL:1/8\nK:D\n{AB}c{de}f|";
			const result = parseAbc(abc);

			expect(result.bars).toHaveLength(1);
			const bar = result.bars[0];

			const graceNotes = bar.filter((n) => n.isGraceNote);
			expect(graceNotes).toHaveLength(4);

			const realNotes = bar.filter((n) => n.pitch && !n.isGraceNote);
			expect(realNotes).toHaveLength(2);
			expect(realNotes[0].pitch).toBe("c");
			expect(realNotes[1].pitch).toBe("f");
		});

		test("grace notes don't affect bar duration", () => {
			const abc = "X:1\nL:1/8\nK:D\n{AB}c2d2|";
			const result = parseAbc(abc);

			// Calculate total duration (should be 1/2, ignoring grace notes)
			let total = new Fraction(0, 1);
			result.bars[0].forEach((note) => {
				if (note.duration) {
					total = total.add(note.duration);
				}
			});

			expect(total).toEqual(new Fraction(1, 2));
		});

		test("grace notes before broken rhythm at start", () => {
			const abc = "X:1\nL:1/8\nK:D\n{AB}>c|";
			const result = parseAbc(abc);

			// Since there's no note before the grace notes, broken rhythm shouldn't apply
			// This tests edge case handling
			const bar = result.bars[0];
			expect(bar).toBeDefined();
		});

		test("grace notes with accidentals and octaves in tune", () => {
			const abc = "X:1\nL:1/8\nK:D\n{^A'_B,}c|";
			const result = parseAbc(abc);

			const graceNotes = result.bars[0].filter((n) => n.isGraceNote);
			expect(graceNotes).toHaveLength(2);
			expect(graceNotes[0]).toMatchObject({
				pitch: "A",
				octave: 1,
			});
			expect(graceNotes[1]).toMatchObject({
				pitch: "B",
				octave: -1,
			});
		});
	});
});
