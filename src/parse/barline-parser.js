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
 * @returns {object} - Classification with type, text, and properties
 *
 * Return object structure:
 * {
 *   type: string,           // 'regular', 'double', 'final', 'repeat-start', 'repeat-end', 'repeat-both', 'repeat-ending', 'other'
 *   text: string,           // Original bar line string
 *   isRepeat: boolean,      // Whether this bar line involves repeats
 *   ending?: number         // For repeat-ending type, which ending (1-6)
 * }
 */
function classifyBarLine(barLineStr) {
	const trimmed = barLineStr.trim();

	// Repeat endings
	if (trimmed.match(/^\|[1-6]$/)) {
		return {
			type: "repeat-ending",
			ending: parseInt(trimmed[1]),
			text: barLineStr,
			isRepeat: true,
		};
	}

	// Start repeat
	if (trimmed.match(/^\|:/) || trimmed.match(/^\[\|/)) {
		return {
			type: "repeat-start",
			text: barLineStr,
			isRepeat: true,
		};
	}

	// End repeat
	if (
		trimmed.match(/^:\|/) ||
		(trimmed.match(/^\|\]/) && !trimmed.match(/^\|\]$/))
	) {
		return {
			type: "repeat-end",
			text: barLineStr,
			isRepeat: true,
		};
	}

	// Double repeat
	if (
		trimmed.match(/^::/) ||
		trimmed.match(/^:\|:/) ||
		trimmed.match(/^::\|:?/) ||
		trimmed.match(/^::\|\|:?/)
	) {
		return {
			type: "repeat-both",
			text: barLineStr,
			isRepeat: true,
		};
	}

	// Final bar
	if (trimmed === "|]") {
		return {
			type: "final",
			text: barLineStr,
			isRepeat: false,
		};
	}

	// Double bar
	if (trimmed === "||") {
		return {
			type: "double",
			text: barLineStr,
			isRepeat: false,
		};
	}

	// Regular bar
	if (trimmed === "|") {
		return {
			type: "regular",
			text: barLineStr,
			isRepeat: false,
		};
	}

	// Unknown/complex bar line
	return {
		type: "other",
		text: barLineStr,
		isRepeat: trimmed.includes(":"),
	};
}

module.exports = {
	classifyBarLine,
};
