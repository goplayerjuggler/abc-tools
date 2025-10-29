const { getContour, contourToSvg } = require("../src/index.js");

const fs = require("fs");
const path = require("path");

describe("contourToSvg", () => {
	describe("basic functionality", () => {
		test("generates valid SVG for simple tune", () => {
			const abc = `X:1
T: Test Tune
L:1/8
K:C
CDE`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour);

			expect(svg).toContain("<svg");
			expect(svg).toContain("</svg>");
			expect(svg).toContain("xmlns");
			expect(svg).toContain("viewBox");
		});

		test("handles contour with held notes", () => {
			const abc = `X:1
L:1/8
K:C
C2D`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour);

			expect(svg).toContain("line");
			// By default, held notes now use same colour as played notes
			expect(svg).toContain("#2563eb");
		});

		test("handles contour with subdivisions", () => {
			const abc = `X:1
L:1/8
K:C
C/D/E`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour);

			expect(svg).toContain("line");
			expect(contour.durations).toBeDefined();
			expect(contour.durations.length).toBe(2);
		});

		test("handles contour with silences", () => {
			const abc = `X:1
L:1/8
K:C
CzD`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour);

			// Silences should not be drawn, but should affect spacing
			// The SVG should only contain lines for C and D
			expect(svg).toContain("line");
			// Count the number of horizontal lines (should be 2 for notes + 1 vertical connector + Y axis + baseline)
			const lineCount = (svg.match(/<line/g) || []).length;
			expect(lineCount).toBeGreaterThanOrEqual(2);
		});

		test("silences create spacing without drawing", () => {
			const abcWithSilence = `X:1
L:1/8
K:C
CzD`;
			const abcWithoutSilence = `X:1
L:1/8
K:C
CD`;

			const contourWithSilence = getContour(abcWithSilence);
			const contourWithoutSilence = getContour(abcWithoutSilence);

			const svgWithSilence = contourToSvg(contourWithSilence);
			const svgWithoutSilence = contourToSvg(contourWithoutSilence);

			// Extract width from SVG
			const widthMatch1 = svgWithSilence.match(/width="(\d+)"/);
			const widthMatch2 = svgWithoutSilence.match(/width="(\d+)"/);

			expect(widthMatch1).toBeTruthy();
			expect(widthMatch2).toBeTruthy();

			const width1 = parseInt(widthMatch1[1]);
			const width2 = parseInt(widthMatch2[1]);

			// SVG with silence should be wider
			expect(width1).toBeGreaterThan(width2);
		});

		test("throws error for invalid contour", () => {
			expect(() => contourToSvg(null)).toThrow("Invalid contour object");
			expect(() => contourToSvg({})).toThrow("Invalid contour object");
		});

		test("produces landscape-oriented SVG", () => {
			const abc = `X:1
L:1/8
K:C
CDEFGABC`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour);

			const widthMatch = svg.match(/width="(\d+)"/);
			const heightMatch = svg.match(/height="(\d+)"/);

			expect(widthMatch).toBeTruthy();
			expect(heightMatch).toBeTruthy();

			const width = parseInt(widthMatch[1]);
			const height = parseInt(heightMatch[1]);

			// Width should be greater than height (landscape)
			expect(width).toBeGreaterThan(height);
		});
	});

	describe("note start markers", () => {
		test("by default, only shows markers when previous note is same pitch", () => {
			const abc = `X:1
L:1/8
K:C
CDE`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour);

			// With default onlyShowMeaningfulStartOfPlayedNotes=true,
			// no markers should appear (all notes are different pitches)
			const circleMatches = svg.match(/<circle/g);
			expect(circleMatches).toBeNull();
		});

		test("shows marker when played note repeats same pitch", () => {
			const abc = `X:1
L:1/8
K:C
CDCC`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour);

			// Should have 1 circle (the second C, which repeats the pitch of the first C)
			const circleMatches = svg.match(/<circle/g);
			expect(circleMatches).not.toBeNull();
			expect(circleMatches.length).toBe(1);
		});

		test("shows markers for all played notes when onlyShowMeaningfulStartOfPlayedNotes is false", () => {
			const abc = `X:1
L:1/8
K:C
CDE`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour, {
				onlyShowMeaningfulStartOfPlayedNotes: false,
			});

			// Should have 3 circle elements (one for each played note)
			const circleMatches = svg.match(/<circle/g);
			expect(circleMatches).not.toBeNull();
			expect(circleMatches.length).toBe(3);
		});

		test("does not include note start markers for held notes", () => {
			const abc = `X:1
L:1/8
K:C
C2C`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour, {
				onlyShowMeaningfulStartOfPlayedNotes: false,
			});

			// Should have 2 circle elements (first C and third C are played, middle is held)
			const circleMatches = svg.match(/<circle/g);
			expect(circleMatches).not.toBeNull();
			expect(circleMatches.length).toBe(2);
		});

		test("silences do not get note start markers", () => {
			const abc = `X:1
L:1/8
K:C
CzD`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour, {
				onlyShowMeaningfulStartOfPlayedNotes: false,
			});

			// Should have 2 circles (C and D, not the silence)
			const circleMatches = svg.match(/<circle/g);
			expect(circleMatches).not.toBeNull();
			expect(circleMatches.length).toBe(2);
		});

		test("shows marker when note repeats after silence", () => {
			const abc = `X:1
L:1/8
K:C
CzC`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour);

			// Should have 1 circle (the second C repeats the pitch after silence)
			const circleMatches = svg.match(/<circle/g);
			expect(circleMatches).not.toBeNull();
			expect(circleMatches.length).toBe(1);
		});

		test("note start markers use played colour", () => {
			const abc = `X:1
L:1/8
K:C
CDCC`;
			const contour = getContour(abc);
			const customColour = "#ff0000";
			const svg = contourToSvg(contour, { playedColor: customColour });

			expect(svg).toContain(`fill="${customColour}"`);
		});

		test("respects custom note start radius", () => {
			const abc = `X:1
L:1/8
K:C
CDCC`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour, { noteStartRadius: 5 });

			expect(svg).toContain('r="5"');
		});
	});

	describe("Y axis rendering", () => {
		test("includes Y axis by default", () => {
			const abc = `X:1
L:1/8
K:G
GAB`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour);

			// Should contain line elements for Y axis
			expect(svg).toContain("<line");

			// Count total lines (Y axis + ticks + baseline + segments + connectors)
			const lineMatches = svg.match(/<line/g);
			expect(lineMatches).not.toBeNull();
			expect(lineMatches.length).toBeGreaterThan(3);
		});

		test("can disable Y axis", () => {
			const abc = `X:1
L:1/8
K:G
GAB`;
			const contour = getContour(abc);
			const svgWithoutAxis = contourToSvg(contour, { showYAxis: false });

			// Without Y axis, should have fewer lines
			const svgWithAxis = contourToSvg(contour, { showYAxis: true });

			const linesWithout = (svgWithoutAxis.match(/<line/g) || []).length;
			const linesWith = (svgWithAxis.match(/<line/g) || []).length;

			expect(linesWithout).toBeLessThan(linesWith);
		});

		test("respects custom Y axis colour", () => {
			const abc = `X:1
L:1/8
K:G
GAB`;
			const contour = getContour(abc);
			const customColour = "#ff00ff";
			const svg = contourToSvg(contour, { yAxisColor: customColour });

			expect(svg).toContain(`stroke="${customColour}"`);
		});

		test("includes tonic ticks at positions divisible by 7", () => {
			const abc = `X:1
L:1/8
K:C
C,,,c'`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour);

			// Should contain tick marks
			expect(svg).toContain("<line");

			// Verify SVG is valid
			expect(svg).toContain("</svg>");
		});

		test("includes 5th degree ticks at appropriate positions", () => {
			const abc = `X:1
L:1/8
K:C
CGc`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour);

			// Should contain multiple tick marks
			const lineMatches = svg.match(/<line/g);
			expect(lineMatches).not.toBeNull();
			expect(lineMatches.length).toBeGreaterThan(5);
		});

		test("only draws ticks within vertical range", () => {
			const abc = `X:1
L:1/8
K:C
CDE`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour, { minDegree: -2, maxDegree: 3 });

			// Should have fewer ticks than a wide range
			const svgWideRange = contourToSvg(contour, {
				minDegree: -20,
				maxDegree: 20,
			});

			const linesLimited = (svg.match(/<line/g) || []).length;
			const linesWide = (svgWideRange.match(/<line/g) || []).length;

			expect(linesLimited).toBeLessThan(linesWide);
		});

		test("respects custom tick lengths", () => {
			const abc = `X:1
L:1/8
K:C
CGc`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour, {
				yAxisTickLength: 8,
				yAxisTonicTickLength: 12,
			});

			// SVG should be valid and contain line elements
			expect(svg).toContain("<line");
			expect(svg).toContain("</svg>");
		});
	});

	describe("held notes appearance", () => {
		test("held notes use same colour as played notes by default", () => {
			const abc = `X:1
L:1/8
K:C
C2`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour);

			// Both segments should use the default colour
			const defaultColour = "#2563eb";
			const colourMatches = svg.match(
				new RegExp(`stroke="${defaultColour}"`, "g")
			);
			expect(colourMatches).not.toBeNull();
			expect(colourMatches.length).toBeGreaterThan(1);
		});

		test("can customise held note colour independently", () => {
			const abc = `X:1
L:1/8
K:C
C2`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour, {
				playedColor: "#0000ff",
				heldColor: "#00ffff",
			});

			expect(svg).toContain('stroke="#0000ff"');
			expect(svg).toContain('stroke="#00ffff"');
		});
	});

	describe("real tune examples", () => {
		test("The Munster (jig)", () => {
			const abc = `X:1
T: The Munster
R: jig
L:1/8
M:12/8
K:G major
G2B AGA B2d gdB`;

			const contour = getContour(abc);
			const svg = contourToSvg(contour);

			expect(svg).toContain("<svg");
			expect(contour.sortKey.length).toBeGreaterThanOrEqual(10);
			// Should not have circles for played notes - no repeated notes of same pitch
			expect(svg).not.toContain("<circle");
		});

		test("The Colliers (reel)", () => {
			const abc = `X:1
T: The Colliers'
R: reel
L:1/8
M:4/2
K:D mixo
FDE/F/G A2AB cAdB cAG2 |`;

			const contour = getContour(abc);
			const svg = contourToSvg(contour);

			expect(svg).toContain("<svg");
			expect(contour.durations).toBeDefined();
			// Should have circles for played notes
			expect(svg).toContain("<circle");
		});

		test("The Flogging (reel)", () => {
			const abc = `X: 12
T: The Flogging
R: reel
M: 4/2
L: 1/8
K: Gmaj
BGGA BGdG BGGA Bdgd|`;

			const contour = getContour(abc);
			const svg = contourToSvg(contour);

			expect(svg).toContain("<svg");
			// Should have circles and Y axis
			expect(svg).toContain("<circle");
			const lineMatches = svg.match(/<line/g);
			expect(lineMatches).not.toBeNull();
		});

		test("handles durations with triplets", () => {
			const abc = `X:1
L:1/8
K:C
(3CDEF`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour, {
				onlyShowMeaningfulStartOfPlayedNotes: false,
			});

			// Should have 4 circles (all are played notes) when showing all markers
			const circleMatches = svg.match(/<circle/g);
			expect(circleMatches).not.toBeNull();
			expect(circleMatches.length).toBe(4);
		});
	});

	describe("custom configuration", () => {
		test("accepts custom colours", () => {
			const abc = `X:1
L:1/8
K:C
C2D`;
			const contour = getContour(abc);
			const customConfig = {
				playedColor: "#ff0000",
				heldColor: "#ff9999",
			};
			const svg = contourToSvg(contour, customConfig);

			expect(svg).toContain("#ff0000");
			expect(svg).toContain("#ff9999");
		});

		test("accepts custom dimensions", () => {
			const abc = `X:1
L:1/8
K:C
CDE`;
			const contour = getContour(abc);
			const customConfig = {
				unitWidth: 40,
				degreeHeight: 20,
			};
			const svg = contourToSvg(contour, customConfig);

			expect(svg).toContain("<svg");
			// Check that dimensions are larger due to custom config
			const widthMatch = svg.match(/width="(\d+)"/);
			expect(widthMatch).toBeTruthy();
			const width = parseInt(widthMatch[1]);
			// With 3 notes and unitWidth=40, should be wider than default (unitWidth=15)
			expect(width).toBeGreaterThan(60);
		});

		test("accepts fixed vertical range", () => {
			const abc = `X:1
L:1/8
K:C
CDE`;
			const contour = getContour(abc);
			const customConfig = {
				minDegree: -15,
				maxDegree: 15,
			};
			const svg = contourToSvg(contour, customConfig);

			expect(svg).toContain("<svg");
			// With fixed range of 30 degrees and degreeHeight=5, height should be consistent
			const heightMatch = svg.match(/height="(\d+)"/);
			expect(heightMatch).toBeTruthy();
		});

		test("fixed vertical range makes consistent heights", () => {
			const abc1 = `X:1
L:1/8
K:C
CDE`;
			const abc2 = `X:1
L:1/8
K:C
C,DEfgab`;

			const contour1 = getContour(abc1);
			const contour2 = getContour(abc2);

			const config = { minDegree: -15, maxDegree: 15 };

			const svg1 = contourToSvg(contour1, config);
			const svg2 = contourToSvg(contour2, config);

			const height1Match = svg1.match(/height="(\d+)"/);
			const height2Match = svg2.match(/height="(\d+)"/);

			expect(height1Match).toBeTruthy();
			expect(height2Match).toBeTruthy();

			const height1 = parseInt(height1Match[1]);
			const height2 = parseInt(height2Match[1]);

			// Heights should be equal with fixed range
			expect(height1).toBe(height2);
		});

		test("custom Y axis configuration", () => {
			const abc = `X:1
L:1/8
K:C
CDEFG`;
			const contour = getContour(abc);
			const svg = contourToSvg(contour, {
				yAxisColor: "#00ff00",
				yAxisWidth: 2,
				yAxisTickLength: 6,
				yAxisTonicTickLength: 10,
			});

			expect(svg).toContain('stroke="#00ff00"');
			expect(svg).toContain('stroke-width="2"');
		});
	});

	describe("baseline rendering", () => {
		test("includes baseline when degree 0 is in range", () => {
			const abc = `X:1
L:1/8
K:C
CDEFG`;
			const contour = getContour(abc);
			const bc = "#e5e7eb";
			const svg = contourToSvg(contour, { baselineColor: bc });

			// Should contain baseline colour
			expect(svg).toContain(bc);
		});

		test("baseline appears with fixed range including 0", () => {
			const abc = `X:1
L:1/8
K:C
cdefg`;
			const contour = getContour(abc);
			const bc = "#e5e7eb";
			const svg = contourToSvg(contour, {
				minDegree: -15,
				maxDegree: 15,
				baselineColor: bc,
			});

			// Should contain baseline even if notes don't reach degree 0
			expect(svg).toContain(bc);
		});
	});

	describe("visual output generation", () => {
		// This test generates actual SVG files for manual inspection
		test.skip("generate SVG files for visual inspection", () => {
			const outputDir = path.join(__dirname, "..", "test-output", "svg");
			fs.mkdirSync(outputDir, { recursive: true });

			const testCases = [
				{
					name: "simple-ascending",
					abc: `X:1\nL:1/8\nK:C\nCDEFGAB`,
				},
				{
					name: "the-munster",
					abc: `X:1\nT: The Munster\nR: jig\nL:1/8\nM:12/8\nK:G major\nG2B AGA B2d gdB`,
				},
				{
					name: "with-subdivisions",
					abc: `X:1\nL:1/8\nK:C\nC/D/E F/G/A B`,
				},
				{
					name: "with-silences",
					abc: `X:1\nL:1/8\nK:C\nC z D z E z`,
				},
				{
					name: "held-vs-repeated",
					abc: `X:1\nL:1/8\nK:C\nC2 C C2`,
				},
				{
					name: "multiple-silences",
					abc: `X:1\nL:1/8\nK:C\nC z2 D z E`,
				},
				{
					name: "comparison-low-range",
					abc: `X:1\nL:1/8\nK:C\nC,D,E,F,`,
				},
				{
					name: "comparison-mid-range",
					abc: `X:1\nL:1/8\nK:C\nCDEF`,
				},
				{
					name: "comparison-high-range",
					abc: `X:1\nL:1/8\nK:C\ncdef`,
				},
			];

			for (const testCase of testCases) {
				const contour = getContour(testCase.abc);
				const svg = contourToSvg(contour);
				const filename = path.join(outputDir, `${testCase.name}.svg`);
				fs.writeFileSync(filename, svg);
				console.log(`Generated: ${filename}`);
			}

			const autoConfig = { minDegree: null, maxDegree: null };
			for (const testCase of testCases) {
				const contour = getContour(testCase.abc);
				const svg = contourToSvg(contour, autoConfig);
				const filename = path.join(
					outputDir,
					`${testCase.name}-auto-range.svg`
				);
				fs.writeFileSync(filename, svg);
				console.log(`Generated: ${filename}`);
			}
		});
	});
});
