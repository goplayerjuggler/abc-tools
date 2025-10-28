const {
	getContour,
	sortKeyToString,
	compare,
	sortArray,
	decodeChar,
	getContourFromFullAbc,
} = require("../src/index.js");

describe("ABC Tools - comparing", () => {
	describe("Basic encoding", () => {
		test("G major low note", () => {
			const abc1 = `X:1
R: jig
L:1/8
M:1/8
K:G major
DG`;

			const obj1 = getContour(abc1);
			const decoded1 = Array.from(obj1.sortKey).map((c) => decodeChar(c));

			expect(decoded1[0].isHeld).toBe(false);
			expect(decoded1[0].position).toBeLessThan(decoded1[1].position);
			expect(obj1.sortKey.length).toBe(2);
		});
		test("G major held note", () => {
			const abc1 = `X:1
T: Test 1
R: jig
L:1/8
M:12/8
K:G major
G2B`;

			const obj1 = getContour(abc1);
			const decoded1 = Array.from(obj1.sortKey).map((c) => decodeChar(c));

			expect(decoded1[0].isHeld).toBe(false);
			expect(decoded1[1].isHeld).toBe(true);
			expect(decoded1[0].position).toBe(decoded1[1].position);
			expect(obj1.sortKey.length).toBeGreaterThan(0);
		});
	});

	describe("Held vs repeated notes; ties", () => {
		test("held note vs repeated note", () => {
			const abcHeld = "X:1\nL:1/8\nK:C\nC2";
			const abcRepeated = "X:1\nL:1/8\nK:C\nCC";

			const objHeld = getContour(abcHeld);
			const objRepeated = getContour(abcRepeated);

			const decodedHeld = Array.from(objHeld.sortKey).map((c) => decodeChar(c));
			const decodedRep = Array.from(objRepeated.sortKey).map((c) =>
				decodeChar(c)
			);

			expect(decodedHeld[1].isHeld).toBe(true);
			expect(decodedRep[1].isHeld).toBe(false);
			expect(compare(objHeld, objRepeated)).toBe(-1);
		});

		test("ties", () => {
			const t1 = "X:1\nL:1/8\nK:D\nD2",
				t2 = "X:1\nL:1/8\nK:D\nD-D",
				t3 = "X:1\nL:1/8\nK:D\nD-E",
				t4 = "X:1\nL:1/8\nK:D\nDE",
				c1 = getContour(t1),
				c2 = getContour(t2),
				c3 = getContour(t3),
				c4 = getContour(t4);
			expect(compare(c1, c2)).toBe(0);
			expect(compare(c3, c4)).toBe(0);

			expect(compare(c1, c3)).toBe(-1);
		});
		test("broken rhythms", () => {
			const t1 = "X:1\nL:1/8\nK:D\nDE",
				t2 = "X:1\nL:1/8\nK:D\nD>E",
				t3 = "X:1\nL:1/8\nK:D\nD<E",
				c1 = getContour(t1),
				c2 = getContour(t2),
				c3 = getContour(t3);
			expect(compare(c2, c1)).toBe(-1);
			expect(compare(c1, c3)).toBe(-1);
		});
		test("real barndances", () => {
			const t1 = `X: 1
T: Gypsy Princess
M: 4/2
L: 1/8
K: A
c3c .c2c2 BcBA F2EF |
`,
				t2 = `X:1
T:Lynch's
R:barndance
L:1/8
M:4/4
K:Dmajor
|:A/|F2 F2 A2 A2|G>FG>A B2 B2|A>dc>B A>GF>E|`,
				c1 = getContourFromFullAbc(t1),
				c2 = getContourFromFullAbc(t2);
			console.log(sortKeyToString(c1.sortKey));
			console.log(sortKeyToString(c2.sortKey));

			expect(compare(c1, c2)).toBe(-1); //held note goes before a repeated one
		});
		test("real barndances 2", () => {
			const t1 = `X:1
T:Éigse An Spidéil
C:Caitlín Nic Gabhann
R:barndance
L:1/8
M:4/4
K:Gmajor
|:G2 (3GGG G2G2|GABc dBGB|A2 (3AAA A3d|(3efg ab gedB|
`,
				t2 = `X:1
T:The Old Boreen
C:Vincent Broderick
R:barndance
L:1/8
M:4/4
K:Gmajor
D|:G3A B3A|GAGE D3E|`,
				c1 = getContourFromFullAbc(t1),
				c2 = getContourFromFullAbc(t2);
			console.log(sortKeyToString(c1.sortKey));
			console.log(sortKeyToString(c2.sortKey));

			expect(compare(c1, c2)).toBe(1); //t1 - whole first bar is on the tonic, but the start of the triplet is played, while t2 still has a held - so t2 goes first!
		});
	});

	describe("Durations", () => {
		test("subdivision durations", () => {
			const abcSub = "X:1\nL:1/8\nK:C\nC/D/E";
			const objSub = getContour(abcSub);

			expect(objSub.sortKey.length).toBe(3);
			expect(objSub.durations).toBeDefined();
			expect(objSub.durations.length).toBe(2);
			expect(objSub.durations[0].d).toBe(2);
		});

		test("triplet durations", () => {
			const abcSub2 = "X:1\nL:1/8\nK:C\n(3CDEF";
			const objSub2 = getContour(abcSub2);

			expect(objSub2.sortKey.length).toBe(4);
			expect(objSub2.durations).toBeDefined();
			expect(objSub2.durations.length).toBe(3);
			expect(objSub2.durations[0].d).toBe(3);
		});

		test("triplet vs sixteenth notes comparison", () => {
			const abcTriplet = "X:1\nL:1/8\nK:C\n(3CDE F";
			const abcSixteenth = "X:1\nL:1/8\nK:C\nC/D/E F";

			const objTriplet = getContour(abcTriplet);
			const objSixteenth = getContour(abcSixteenth);

			expect(objTriplet.durations[0].d).toBe(3);
			expect(objSixteenth.durations[0].d).toBe(2);

			const comparison = compare(objTriplet, objSixteenth);
			expect(typeof comparison).toBe("number");
		});

		test("semiquavers as CSB", () => {
			const theColliers14 = {
				name: "The Colliers",
				abc: `X:1
T: The Colliers
R: reel
L: 1/8
M:4/4
K:D mixo
FDE/F/G A2AB cAdB cAG2 |`,
			};
			const objSub14 = getContour(theColliers14.abc, { maxNbUnitLengths: 22 });

			expect(objSub14.sortKey.length).toBe(17);
			expect(objSub14.durations).toBeDefined();
			expect(objSub14.durations.length).toBe(2);
			expect(objSub14.durations[0].d).toBe(2);
		});
	});

	describe("Octave shifts", () => {
		test("different octaves compare correctly", () => {
			const abcOctaves = "X:1\nL:1/8\nK:C\nC, C c c'";
			const objOctaves = getContour(abcOctaves);

			const decodedOct = Array.from(objOctaves.sortKey).map((c) =>
				decodeChar(c)
			);

			expect(decodedOct[0].position).toBeLessThan(decodedOct[1].position);
			expect(decodedOct[1].position).toBeLessThan(decodedOct[2].position);
			expect(decodedOct[2].position).toBeLessThan(decodedOct[3].position);
		});
	});

	describe("Complex tunes", () => {
		test("The Munster", () => {
			const abcMunster = `X:1
T: The Munster
R: jig
L:1/8
M:12/8
K:G major
G2B AGA B2d gdB`;

			const objMunster = getContour(abcMunster, { maxNbUnitLengths: 22 });
			expect(objMunster.sortKey.length).toBe(12);
		});
	});

	describe("Different keys, same contour", () => {
		test("same modal contour produces same compare key", () => {
			const abcG = "X:1\nL:1/8\nK:G\nGAB";
			const abcD = "X:1\nL:1/8\nK:D\nDEF";

			const objG = getContour(abcG);
			const objD = getContour(abcD);

			expect(objG.sortKey).toBe(objD.sortKey);
		});
	});

	describe("Array compareing", () => {
		test("compares array correctly", () => {
			const tunes = [
				{ name: "Tune 1", abc: "X:1\nL:1/8\nK:C\nccc" },
				{ name: "Tune 2", abc: "X:1\nL:1/8\nK:C\nCCC" },
				{ name: "Tune 3", abc: "X:1\nL:1/8\nK:C\nCDE" },
			];

			sortArray(tunes);

			expect(tunes[0].name).toBe("Tune 2");
			expect(tunes[1].name).toBe("Tune 3");
			expect(tunes[2].name).toBe("Tune 1");
		});
	});

	describe("The Flogging vs The Colliers’", () => {
		const theFlogging = {
			name: "The Flogging",
			abc: `X: 12
T: The Flogging
R: reel
M: 4/2
L: 1/8
K: Gmaj
BGGA BGdG BGGA Bdgd|`,
		};

		const theColliers = {
			name: "The Colliers",
			abc: `X:1
T: The Colliers'
R: reel
L:1/8
M:4/2
K:D mixo
FDE/F/G A2AB cAdB cAG2 |`,
		};

		const theColliers2 = {
			name: "The Colliers (triplet)",
			abc: `X:1
T: The Colliers'
R: reel
L:1/8
M:4/2
K:D mixo
FD(3EFG A2AB cAdB cAG2 |`,
		};

		test("compares two tunes correctly (original order)", () => {
			const tunes = [theFlogging, theColliers];
			sortArray(tunes);

			expect(tunes[0].name).toBe("The Flogging");
			expect(tunes[1].name).toBe("The Colliers");
		});

		test("compares two tunes correctly (reversed order)", () => {
			const tunes = [theColliers, theFlogging];
			sortArray(tunes);

			expect(tunes[0].name).toBe("The Flogging");
			expect(tunes[1].name).toBe("The Colliers");
		});

		test("compares three tunes with triplet variation", () => {
			const tunes = [theColliers2, theColliers, theFlogging];
			sortArray(tunes);

			expect(tunes[0].name).toBe("The Flogging");
			expect(tunes[1].name).toBe("The Colliers (triplet)");
			expect(tunes[2].name).toBe("The Colliers");
		});

		test("same tune with different CSB compares together", () => {
			const theColliers14 = {
				name: "The Colliers",
				abc: `X:1
T: The Colliers
R: reel
L: 1/16
M:4/4
K:D mixo
FDE/F/G A2AB cAdB cAG2 |`, //L:1/16
			};

			const objSub14 = getContour(theColliers14.abc);
			expect(compare(objSub14, theColliers.contour)).toBe(0);
		});
	});

	describe("Silences", () => {
		test("encodes silence correctly", () => {
			const abcSilence = "X:1\nL:1/8\nK:C\nCzD";
			const objSilence = getContour(abcSilence);

			const decodedSilence = Array.from(objSilence.sortKey).map((c) =>
				decodeChar(c)
			);

			expect(decodedSilence[1].isSilence).toBe(true);
			expect(decodedSilence[0].isSilence).toBe(false);
			expect(decodedSilence[2].isSilence).toBe(false);
		});

		test("silence compares before notes", () => {
			const abcSilenceFirst = "X:1\nL:1/8\nK:C\nzC";
			const abcNoteFirst = "X:1\nL:1/8\nK:C\nCC";

			const objSilenceFirst = getContour(abcSilenceFirst);
			const objNoteFirst = getContour(abcNoteFirst);

			expect(compare(objSilenceFirst, objNoteFirst)).toBe(-1);
		});

		test("long silence", () => {
			const abcLongSilence = "X:1\nL:1/8\nK:C\nz2C";
			const objLongSilence = getContour(abcLongSilence);

			const decodedLongSilence = Array.from(objLongSilence.sortKey).map((c) =>
				decodeChar(c)
			);

			expect(decodedLongSilence.length).toBe(3);
			expect(decodedLongSilence[0].isSilence).toBe(true);
			expect(decodedLongSilence[1].isSilence).toBe(true);
			expect(decodedLongSilence[2].isSilence).toBe(false);
		});

		test("short silence", () => {
			const abcShortSilence = "X:1\nL:1/8\nK:C\nz/C";
			const objShortSilence = getContour(abcShortSilence);

			expect(objShortSilence.durations).toBeDefined();
			expect(objShortSilence.durations.length).toBe(1);
			expect(objShortSilence.durations[0].d).toBe(2);
		});
	});
});
