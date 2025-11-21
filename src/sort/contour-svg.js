const { decodeChar } = require("./encode.js");

/**
 * Configuration object for SVG rendering of tune contours
 * @typedef {Object} SvgConfig
 * @property {boolean} connectingVerticalLines - vertical lines joining up notes of different heights
 * @property {boolean} forceBaseline - Ensures the baseline at zero is displayed
 * @property {boolean} onlyShowMeaningfulStartOfPlayedNotes - If true, only show start markers when previous note is same pitch; if false, show on all played notes
 * @property {boolean} showYAxis - Whether to display the Y axis
 * @property {number} connectingVerticalLinesWidth - Width of the vertical connecting lines between segments
 * @property {number} degreeHeight - Height in pixels between scale degrees
 * @property {number} noteStartRadius - Radius of the circle marking note starts (played notes only)
 * @property {number} paddingBottom - Bottom padding in pixels
 * @property {number} paddingLeft - Left padding in pixels
 * @property {number} paddingRight - Right padding in pixels
 * @property {number} paddingTop - Top padding in pixels
 * @property {number} strokeWidth - Width of the contour line segments
 * @property {number} unitWidth - Width in pixels for one unit duration
 * @property {number} baselineWidth - Width in pixels for the baseline
 * @property {number} yAxisTickLength - Length of regular ticks (for 5th degree markers)
 * @property {number} yAxisTickWidth - Width of tick marks
 * @property {number} yAxisTonicTickLength - Length of tonic ticks (for tonic degree markers)
 * @property {number} yAxisWidth - Width of the Y axis line
 * @property {number|null} maxDegree - Maximum degree for vertical range (null for auto)
 * @property {number|null} minDegree - Minimum degree for vertical range (null for auto)
 * @property {string} ariaLabel - Accessible label for screen readers
 * @property {string} baselineColour - Colour for the zero-degree baseline
 * @property {string} class - CSS class name for the SVG element
 * @property {string} heldColour - Colour for held note segments
 * @property {string} playedColour - Colour for played note segments
 * @property {string} yAxisColour - Colour for the Y axis line
 */

/**
 * Default configuration for SVG rendering
 * @type {SvgConfig}
 */
const contourToSvg_defaultConfig = {
	connectingVerticalLines: true,
	connectingVerticalLinesWidth: 0.5,
	degreeHeight: 5,
	paddingTop: 3,
	paddingBottom: 3,
	strokeWidth: 1.2,
	unitWidth: 12,
	playedColour: "#2563eb", // blue
	heldColour: "#2563eb", // same as played (no longer lighter blue)
	baselineColour: "#555555", // Davy's grey
	baselineWidth: 0.5,
	paddingLeft: 10,
	paddingRight: 10,
	minDegree: null,
	maxDegree: null,
	forceBaseline: true,
	class: "contour-svg",
	ariaLabel: "Tune contour",
	noteStartRadius: 2,
	onlyShowMeaningfulStartOfPlayedNotes: false,
	showYAxis: true,
	yAxisColour: "#888888",
	yAxisWidth: 0.5,
	yAxisTickLength: 4,
	yAxisTonicTickLength: 6,
	yAxisTickWidth: 0.5,
};

/**
 * Converts a tune contour object into an SVG visualisation
 *
 * The SVG represents the melodic contour as a series of connected horizontal line segments.
 * Each segment's vertical position corresponds to its modal degree (pitch relative to tonic),
 * and its horizontal length represents its duration relative to the common subdivision of the beat.
 * The resulting SVG is landscape-oriented (wider than tall).
 *
 * Played notes are marked with a small filled circle at their start point.
 * Held notes (continuations of the same pitch) have no start marker.
 *
 * Silences are not drawn but occupy space on the x-axis, causing subsequent notes to be
 * positioned after the cumulative duration of preceding silences.
 *
 * @param {Object} contour - The contour object containing sortKey and optional durations
 * @param {string} contour.sortKey - Encoded string of modal degree information
 * @param {Array<{i: number, n?: number, d: number}>} [contour.durations] - Array of duration modifications
 * @param {Partial<SvgConfig>} [svgConfig] - Optional configuration overrides
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
 * // Auto range - calculates from the contour's actual pitch range
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
 *   maxDegree: null // maxDegree will auto-calculate
 * });
 */
function contourToSvg(contour, svgConfig = {}) {
	const config = { ...contourToSvg_defaultConfig, ...svgConfig };

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

	if (config.forceBaseline) {
		minPosition = Math.min(minPosition, 0);
		maxPosition = Math.max(maxPosition, 0);
	}

	// Calculate SVG dimensions
	const totalWidth = xPosition;
	const positionRange = maxPosition - minPosition;
	const chartHeight = (positionRange + 2) * config.degreeHeight;

	const svgWidth = totalWidth + config.paddingLeft + config.paddingRight;
	const svgHeight = chartHeight + config.paddingTop + config.paddingBottom;

	/**
	 * Converts a modal degree position to Y coordinate in SVG space
	 * @param {number} pos - Modal degree position
	 * @returns {number} Y coordinate
	 */
	const positionToY = (pos) => {
		const relativePos = maxPosition - pos;
		return config.paddingTop + relativePos * config.degreeHeight;
	};

	// Build SVG path elements
	const pathElements = [];

	// Add Y axis if configured
	if (config.showYAxis) {
		const yAxisX = config.paddingLeft - 5;
		const yAxisTop = positionToY(maxPosition);
		const yAxisBottom = positionToY(minPosition);

		pathElements.push(
			`<line x1="${yAxisX}" y1="${yAxisTop}" ` +
				`x2="${yAxisX}" y2="${yAxisBottom}" ` +
				`stroke="${config.yAxisColour}" stroke-width="${config.yAxisWidth}" />`
		);

		// Add tick marks for positions within range
		// Regular ticks at positions: ..., -11, -4, 4, 11, 18, ... (5th degree in each octave)
		// Tonic ticks at positions: ..., -14, -7, 0, 7, 14, ... (tonic in each octave)
		const minPos = Math.floor(minPosition);
		const maxPos = Math.ceil(maxPosition);

		for (let pos = minPos; pos <= maxPos; pos++) {
			let tickLength = 0;

			// Check if this is a tonic position (0, ±7, ±14, ...)
			if (pos % 7 === 0) {
				tickLength = config.yAxisTonicTickLength;
			}
			// Check if this is a 5th position (±4, ±11, ±18, ...)
			else if (pos % 7 === 4 || pos % 7 === -3) {
				tickLength = config.yAxisTickLength;
			}

			if (tickLength > 0) {
				const tickY = positionToY(pos);
				pathElements.push(
					`<line x1="${yAxisX - tickLength}" y1="${tickY}" ` +
						`x2="${yAxisX}" y2="${tickY}" ` +
						`stroke="${config.yAxisColour}" stroke-width="${config.yAxisTickWidth}" />`
				);
			}
		}
	}

	// Add baseline at position 0 if it's within range
	if (minPosition <= 0 && maxPosition >= 0) {
		const baselineY = positionToY(0);
		pathElements.push(
			`<line x1="${config.paddingLeft}" y1="${baselineY}" ` +
				`x2="${config.paddingLeft + totalWidth}" y2="${baselineY}" ` +
				`stroke="${config.baselineColour}" stroke-width="${config.baselineWidth}" />`
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

		const color = seg.isHeld ? config.heldColour : config.playedColour;

		pathElements.push(
			`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" ` +
				`stroke="${color}" stroke-width="${config.strokeWidth}" ` +
				`stroke-linecap="round" />`
		);

		// Add note start marker (filled circle) for played notes
		// If onlyShowMeaningfulStartOfPlayedNotes is true, only show when previous note is same pitch
		if (!seg.isHeld) {
			let showStartMarker = true;

			if (config.onlyShowMeaningfulStartOfPlayedNotes) {
				// Find previous non-silence segment
				let prevNonSilenceIdx = i - 1;
				while (
					prevNonSilenceIdx >= 0 &&
					segments[prevNonSilenceIdx].isSilence
				) {
					prevNonSilenceIdx--;
				}

				// Only show marker if previous note exists and is at same position
				if (prevNonSilenceIdx >= 0) {
					const prevSeg = segments[prevNonSilenceIdx];
					showStartMarker = prevSeg.position === seg.position;
				} else {
					// First note: don't show marker
					showStartMarker = false;
				}
			}

			if (showStartMarker) {
				pathElements.push(
					`<circle cx="${x1}" cy="${y}" r="${config.noteStartRadius}" ` +
						`fill="${color}" />`
				);
			}
		}

		// Add a connecting vertical line to the next segment if it’s not a silence and if the position changes
		if (config.connectingVerticalLines) {
			const nextNonSilenceIdx = i + 1;

			if (
				nextNonSilenceIdx < segments.length &&
				!segments[nextNonSilenceIdx].isSilence
			) {
				const nextSeg = segments[nextNonSilenceIdx];
				const nextY = positionToY(nextSeg.position);
				if (y !== nextY) {
					pathElements.push(
						`<line x1="${x2}" y1="${y}" x2="${x2}" y2="${nextY}" ` +
							`stroke="${config.playedColour}" stroke-width="${config.connectingVerticalLinesWidth}" ` +
							`stroke-linecap="round" />`
					);
				}
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
