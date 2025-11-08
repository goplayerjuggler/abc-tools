// ============================================================================
// ABC BAR LINE PARSING
// ============================================================================
//
// Handles classification of bar lines and repeat notation:
// - Regular bars: |
// - Double bars: ||
// - Final bars: |]
// - Repeat starts: |:, [|
// - Repeat ends: :|, |]
// - Double repeats: ::, :|:
// - Repeat endings: |1, |2, etc.
//
// ============================================================================

/**
 * Classify bar line type
 *
 * @param {string} barLineStr - Bar line string from ABC notation
 * @returns {object} - parsed barline with text, and properties
 *
 * Return object structure:
 * {
 *   text: string,           // Original bar line string
 *   trimmed: string,            // trimmed bar line string
 *   isSectionBreak,              // double bars and ends of repeats are section breaks
 *   isRepeatL: boolean,
 * // true iff there’s a repeat to the left of the bar line; if not the property is omitted
 * // indicates the end of a repeated section
 *
 *   isRepeatR: boolean,
 * // true iff there’s a repeat to the rightt of the bar line; if not the property is omitted
 * // indicates the start of a repeated section
 *
 * }
 *
 *
 */
function parseBarLine(barLineStr) {
	const trimmed = barLineStr.trim();
	const result = {
		text: barLineStr,
		trimmed,
	};
	// Start repeat
	if (trimmed.match(/:$/)) {
		result.isRepeatR = true;
	}
	// End repeat
	if (trimmed.match(/^:/)) {
		result.isRepeatL = true;
		result.isSectionBreak = true;
	}

	// Double bar & other cases: "...ends with one of ||, :| |] or [|"
	if (trimmed.match(/\|\||\|]|\[\|/)) {
		result.isSectionBreak = true;
	}
	return result;
}

module.exports = {
	parseBarLine,
};
