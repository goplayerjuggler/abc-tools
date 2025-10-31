// ============================================================================
// ABC TOKEN UTILITIES
// ============================================================================
//
// Utilities for tokenising ABC music notation:
// - Token regex generation
// - Inline field parsing
// - Whitespace and beaming analysis
// - Bar lines are not captured, but variant endings and 1st and 2nd repeats are captured
// ============================================================================

const TokenRegexComponents = {
	// Tuplet notation: (3, (3:2, (3:2:4
	tuplet: String.raw`\(\d(?::\d?){0,2}`,

	// Grace notes: {ABC}, {^AB_c}, etc.
	graceNotes: String.raw`\{[^}]+\}`,

	// Inline field changes: [K:D], [L:1/4], [M:3/4], [P:A]
	inlineField: String.raw`\[(?:[KLMP]):[^\]]+\]`,

	// Text in quotes: chord symbols "Dm7" or annotations "^text"
	quotedText: String.raw`"[^"]+"`,

	// Bang decoration: !trill!, !fermata!, etc.
	bangDecoration: String.raw`![^!]+!`,

	// Symbol decorations before note: ~, ., M, P, S, T, H, U, V
	// 0..N of them, with optional following white space
	symbolDecoration: String.raw`[~.MPSTHUV]`,

	symbolDecorations() {
		return String.raw`(?:${this.symbolDecoration}\s*)*`;
	},
	bangDecorations() {
		return String.raw`(?:${this.bangDecoration}\s*)*`;
	},

	// Accidental: :, ^, _ (natural, sharp, flat)
	accidental: String.raw`[:^_]?`,

	// Note pitch: A-G (lower octave), a-g (middle octave), z/x (rest), y (dummy)
	// Or chord in brackets: [CEG], [DF#A]
	pitch: String.raw`(?:[A-Ga-gzxy]|\[[A-Ga-g]+\])`,

	// Octave modifiers: ' (up), , (down)
	octave: String.raw`[',]*`,

	// Duration: 2, /2, 3/4, /, //, etc.
	// include all digits, even though things like A0, A5,... are not allowed
	// but we could have A16, or z10 (full bar rest for M:5/4; L:1/8)
	duration: String.raw`[0-9]*\/?[0-9]*`,

	// Tie (-) - optional
	tie: String.raw`-?`,

	// Broken rhythm (>, >>, >>>, <, <<, <<<)
	broken: String.raw`<{1,3}|>{1,3}`,
};

/**
 * Get regex for matching ABC music tokens
 *
 * Matches: tuplets, grace notes, inline fields, chord symbols, notes, rests,
 * chords in brackets, decorations, ties, and broken rhythms
 *
 * @returns {RegExp} - Regular expression for tokenising ABC music
 */
const getTokenRegex = () => {
	const s = TokenRegexComponents;
	// Complete note/rest/chord pattern with optional leading decoration
	const notePattern =
		s.bangDecorations() +
		s.symbolDecorations() +
		s.accidental +
		s.pitch +
		s.octave +
		s.duration +
		s.tie;

	// Combine all patterns with alternation
	const fullPattern = [
		s.tuplet,
		s.graceNotes,
		s.inlineField,
		s.quotedText,
		//allow standalone bang and symbol decorations (?)
		notePattern,
		s.bangDecoration,
		s.broken,
	].join("|");

	return new RegExp(fullPattern, "g");
};

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
