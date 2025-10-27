const { decodeChar } = require("./encode.js");

/**
 * Configuration object for SVG rendering of tune contours
 * @typedef {Object} SvgConfig
 * @property {number} unitWidth - Width in pixels for one unit duration
 * @property {number} degreeHeight - Height in pixels between scale degrees
 * @property {number} strokeWidth - Width of the contour line segments
 * @property {string} playedColor - Colour for played note segments
 * @property {string} heldColor - Colour for held note segments (lighter shade of playedColor)
 * @property {string} baselineColor - Colour for the zero-degree baseline
 * @property {number} paddingTop - Top padding in pixels
 * @property {number} paddingBottom - Bottom padding in pixels
 * @property {number} paddingLeft - Left padding in pixels
 * @property {number} paddingRight - Right padding in pixels
 * @property {number|null} minDegree - Minimum degree for vertical range (null for auto)
 * @property {number|null} maxDegree - Maximum degree for vertical range (null for auto)
 * @property {string} class - CSS class name for the SVG element
 * @property {string} ariaLabel - Accessible label for screen readers
 */

/**
 * Default configuration for SVG rendering
 * @type {SvgConfig}
 */
const contourToSvg_defaultConfig = {
	degreeHeight: 5, // much smaller (default is 12)
	paddingTop: 1, // less padding (default is 20)
	paddingBottom: 1, // less padding (default is 20)
	strokeWidth: 2, // slightly thinner lines (default is 3)
	unitWidth: 15,
	// degreeHeight: 12,
	// strokeWidth: 3,
	playedColor: "#2563eb", // blue
	heldColor: "#93c5fd", // lighter blue (held notes)
	baselineColor: "#e5e7eb", // light grey
	// paddingTop: 20,
	// paddingBottom: 20,
	paddingLeft: 10,
	paddingRight: 10,
	minDegree: null, // null means auto-calculate from contour
	maxDegree: null, // null means auto-calculate from contour
	class: "contour-svg",
	ariaLabel: "Tune contour",
};

/**
 * Converts a tune contour object into an SVG visualization
 *
 * The SVG represents the melodic contour as a series of connected horizontal line segments.
 * Each segment's vertical position corresponds to its modal degree (pitch relative to tonic),
 * and its horizontal length represents its duration relative to the common subdivision of the beat.
 * The resulting SVG is landscape-oriented (wider than tall).
 *
 * Silences are not drawn but occupy space on the x-axis, causing subsequent notes to be
 * positioned after the cumulative duration of preceding silences.
 *
 * @param {Object} contour - The contour object containing sortKey and optional durations
 * @param {string} contour.sortKey - Encoded string of modal degree information
 * @param {Array<{i: number, n?: number, d: number}>} [contour.durations] - Array of duration modifications
 * @param {Partial<SvgConfig>} [userConfig] - Optional configuration overrides
 * @returns {string} SVG markup as a string
 *
 * @example
 * const contour = {
 *   sortKey: 'NPNNMNONM',
 *   durations: [
 *     { i: 0, n: 2, d: 3 },
 *     { i: 7, d: 2 }
 *   ]
 * };
 *
 * // With fixed vertical range for comparing multiple contours
 * const svg = contourToSvg(contour, { minDegree: -15, maxDegree: 15 });
 *
 * // Auto range  - calculates from the contour's actual pitch range
 * const svg2 = contourToSvg(contour, {
 *   minDegree: null,
 *   maxDegree: null
 * });
 *
 * // Fixed range (default) for comparing multiple contours side-by-side
 * const svg1 = contourToSvg(contour);
 *
 * // You can also set just one bound
 * const svg3 = contourToSvg(contour, {
 *   minDegree: -15,
 *   maxDegree: null //maxDegree will auto-calculate
 * });
 */
function contourToSvg(contour, userConfig = {}) {
	const config = { ...contourToSvg_defaultConfig, ...userConfig };

	if (!contour || !contour.sortKey) {
		throw new Error("Invalid contour object: missing sortKey");
	}

	const { sortKey, durations = [] } = contour;

	// Build duration map for quick lookup
	const durationMap = new Map();
	for (const dur of durations) {
		const n = dur.n || 1;
		const d = dur.d;
		durationMap.set(dur.i, n / d);
	}

	// Decode all notes and calculate positions
	const segments = [];
	let xPosition = 0;
	let minPosition = Infinity;
	let maxPosition = -Infinity;

	for (let i = 0; i < sortKey.length; i++) {
		const char = sortKey[i];
		const decoded = decodeChar(char);
		const duration = durationMap.get(i) || 1.0;
		const segmentWidth = duration * config.unitWidth;

		if (!decoded.isSilence) {
			minPosition = Math.min(minPosition, decoded.position);
			maxPosition = Math.max(maxPosition, decoded.position);
		}

		segments.push({
			x: xPosition,
			width: segmentWidth,
			position: decoded.position,
			isHeld: decoded.isHeld,
			isSilence: decoded.isSilence,
		});

		xPosition += segmentWidth;
	}

	// Apply fixed vertical range if configured, otherwise use auto-calculated range
	if (config.minDegree !== null) {
		minPosition = config.minDegree;
	}
	if (config.maxDegree !== null) {
		maxPosition = config.maxDegree;
	}

	// Calculate SVG dimensions
	const totalWidth = xPosition;
	const positionRange = maxPosition - minPosition;
	const chartHeight = (positionRange + 2) * config.degreeHeight;

	const svgWidth = totalWidth + config.paddingLeft + config.paddingRight;
	const svgHeight = chartHeight + config.paddingTop + config.paddingBottom;

	// Helper function to convert position to Y coordinate
	const positionToY = (pos) => {
		const relativePos = maxPosition - pos;
		return config.paddingTop + relativePos * config.degreeHeight;
	};

	// Build SVG path elements
	const pathElements = [];

	// Add baseline at position 0 if it's within range
	if (minPosition <= 0 && maxPosition >= 0) {
		const baselineY = positionToY(0);
		pathElements.push(
			`<line x1="${config.paddingLeft}" y1="${baselineY}" ` +
				`x2="${config.paddingLeft + totalWidth}" y2="${baselineY}" ` +
				`stroke="${config.baselineColor}" stroke-width="1" />`
		);
	}

	// Add contour segments (skip silences - they only affect x-positioning)
	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i];

		// Skip drawing silences - they only take up space on x-axis
		if (seg.isSilence) {
			continue;
		}

		const x1 = config.paddingLeft + seg.x;
		const x2 = x1 + seg.width;
		const y = positionToY(seg.position);

		const color = seg.isHeld ? config.heldColor : config.playedColor;

		pathElements.push(
			`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" ` +
				`stroke="${color}" stroke-width="${config.strokeWidth}" ` +
				`stroke-linecap="round" />`
		);

		// Add connecting vertical line to next non-silence segment if position changes
		let nextNonSilenceIdx = i + 1;
		while (
			nextNonSilenceIdx < segments.length &&
			segments[nextNonSilenceIdx].isSilence
		) {
			nextNonSilenceIdx++;
		}

		if (nextNonSilenceIdx < segments.length) {
			const nextSeg = segments[nextNonSilenceIdx];
			const nextY = positionToY(nextSeg.position);
			if (y !== nextY) {
				pathElements.push(
					`<line x1="${x2}" y1="${y}" x2="${x2}" y2="${nextY}" ` +
						`stroke="${config.playedColor}" stroke-width="${config.strokeWidth}" ` +
						`stroke-linecap="round" />`
				);
			}
		}
	}

	// Assemble SVG
	const classAttr = config.class ? ` class="${config.class}"` : "";
	const ariaLabelAttr = config.ariaLabel
		? ` aria-label="${config.ariaLabel}"`
		: "";

	const svg = `<svg xmlns="http://www.w3.org/2000/svg"${classAttr}${ariaLabelAttr} width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img">
  <rect width="${svgWidth}" height="${svgHeight}" fill="white"/>
  ${pathElements.join("\n  ")}
</svg>`;

	return svg;
}

module.exports = {
	contourToSvg,
	contourToSvg_defaultConfig,
};
