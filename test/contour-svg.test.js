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
			// Should contain held color (lighter shade)
			expect(svg).toContain("#93c5fd");
			// Should also contain played color
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
			// Count the number of horizontal lines (should be 2 for notes + 1 vertical connector)
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

	describe("real tune examples", () => {
		test("The Munster (jig)", () => {
			const abc = `X:1
T: The Munster
R: jig
L:1/8
M:12/8
K:G major
G2B AGA B2d gdB`;

			const contour = getContour(abc, { svgConfig: { heldColor: "#93c5fd" } });
			const svg = contourToSvg(contour);

			expect(svg).toContain("<svg");
			expect(contour.sortKey.length).toBeGreaterThanOrEqual(10);
			expect(svg).toContain("#93c5fd"); // held notes present
		});

		test("The Colliers (reel)", () => {
			const abc = `X:1
T: The Colliers'
R: reel
L:1/8
M:4/2
K:D mixo
FDE/F/G A2AB cAdB cAG2 |`;

			const contour = getContour(abc, { svgConfig: { heldColor: "#93c5fd" } });
			const svg = contourToSvg(contour);

			expect(svg).toContain("<svg");
			expect(contour.durations).toBeDefined();
			expect(svg).toContain("#93c5fd"); // held notes present
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
			// With 3 notes and unitWidth=40, should be wider than default (unitWidth=20)
			expect(width).toBeGreaterThan(100);
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
			// With fixed range of 30 degrees and degreeHeight=12, height should be consistent
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
	});

	describe("baseline rendering", () => {
		test("includes baseline when degree 0 is in range", () => {
			const abc = `X:1
L:1/8
K:C
CDEFG`;
			const contour = getContour(abc),
				bc = "#e5e7eb";
			const svg = contourToSvg(contour, { baselineColor: bc });

			// Should contain baseline color
			expect(svg).toContain(bc);
		});

		test("baseline appears with fixed range including 0", () => {
			const abc = `X:1
L:1/8
K:C
cdefg`;
			const contour = getContour(abc),
				bc = "#e5e7eb";
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
		test("generate SVG files for visual inspection", () => {
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
