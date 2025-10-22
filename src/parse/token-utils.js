// ============================================================================
// ABC TOKEN UTILITIES
// ============================================================================
//
// Utilities for tokenising ABC music notation:
// - Token regex generation
// - Inline field parsing
// - Whitespace and beaming analysis
//
// ============================================================================

/**
 * Get regex for matching ABC music tokens
 * Matches: tuplets, inline fields, chord symbols, notes, rests, chords in brackets, decorations, broken rhythms
 *
 * @returns {RegExp} - Regular expression for tokenising ABC music
 */
const getTokenRegex = () =>
	/\(\d(?::\d?){0,2}|\[([KLMP]):[^\]]+\]|"[^"]+"|(?:!([^!]+)!\s*)?[~.MPSTHUV]*[=^_]?(?:[A-Ga-gzxy]|\[[A-Ga-gzxy]+\])[',]*[0-9]*\/?[0-9]*(?:-|\s*(?:<{1,3}|>{1,3}))?|!([^!]+)!/g;

/**
 * Parse inline field from music section
 * Inline fields allow changing key, meter, length, or part mid-tune
 *
 * @param {string} token - Token string to parse
 * @returns {object|null} - { field, value } or null if not an inline field
 *
 * Supported inline fields:
 * - [K:...] - Key signature change
 * - [L:...] - Unit length change
 * - [M:...] - Meter change
 * - [P:...] - Part marker
 */
function parseInlineField(token) {
	const fieldMatch = token.match(/^\[([KLMP]):\s*([^\]]+)\]$/);
	if (fieldMatch) {
		return {
			field: fieldMatch[1],
			value: fieldMatch[2].trim(),
		};
	}
	return null;
}

/**
 * Analyze whitespace and back quotes after a token
 * Returns object describing the spacing/beaming context
 * Back quotes (`) are ignored for beaming but preserved for reconstruction
 *
 * @param {string} segment - The music segment to analyze
 * @param {number} tokenEndPos - Position where the token ends
 * @returns {object} - Spacing analysis object
 *
 * Return object structure:
 * {
 *   whitespace: string,     // Actual whitespace characters (back quotes removed)
 *   backquotes: number,     // Number of ` characters for reconstruction
 *   beamBreak: boolean,     // True if beam should break (multiple spaces/newline)
 *   lineBreak: boolean      // True if there was a newline after this token
 * }
 */
function analyzeSpacing(segment, tokenEndPos) {
	if (tokenEndPos >= segment.length) {
		return {
			whitespace: "",
			backquotes: 0,
			beamBreak: false,
			lineBreak: false,
		};
	}

	const remaining = segment.substring(tokenEndPos);

	// Match whitespace and/or back quotes
	const spacingMatch = remaining.match(/^([\s`]+)/);

	if (!spacingMatch) {
		return {
			whitespace: "",
			backquotes: 0,
			beamBreak: false,
			lineBreak: false,
		};
	}

	const fullSpacing = spacingMatch[1];

	// Count back quotes
	const backquotes = (fullSpacing.match(/`/g) || []).length;

	// Extract just whitespace (no back quotes)
	const whitespace = fullSpacing.replace(/`/g, "");

	return {
		whitespace,
		backquotes,
		beamBreak: whitespace.length > 1 || whitespace.includes("\n"), // Multiple spaces or newline breaks beam
		lineBreak: whitespace.includes("\n"),
	};
}

module.exports = {
	getTokenRegex,
	parseInlineField,
	analyzeSpacing,
};
