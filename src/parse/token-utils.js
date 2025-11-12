// ============================================================================
// ABC TOKEN UTILITIES
// ============================================================================
//
// Utilities for tokenising ABC music notation:
// - Token regex generation
// - Inline field parsing
// - Whitespace and beaming analysis
// - Bar lines are captured, and variant endings and 1st and 2nd repeats are captured
// ============================================================================

const // captures not only |1 |2, but also :|1 :||1 :|2 :||2
	repeat_1Or2 = String.raw`:?\|{1,2}[12]`,
	TokenRegexComponents = {
		// Tuplet notation: (3, (3:2, (3:2:4
		tuplet: String.raw`\(\d(?::\d?){0,2}`,

		// Grace notes: {ABC}, {^AB_c}, etc.
		graceNotes: String.raw`\{[^}]+\}`,

		// Inline field changes: [K:D], [L:1/4], [M:3/4], [P:A]
		inlineField: String.raw`\[([KLMP]):\s*([^\]]+)\]`,

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

		// variant ending - including one way of writing 1st and second repeats. Only handle single digits.
		// examples: [1 [2 [3 [4 [1-3 [1-3,5-7
		variantEnding: String.raw`\[\d(?:-\d)?(?:,\d(?:-\d)?)*`,

		// 1st & 2nd repeats. Only handle single digits.
		// examples: `|1`, `|2`
		// Note that the other syntax, `[1`, `[2`, will be captured by the variantEnding component
		repeat_1Or2,

		/**
		 * Bar line - includes trailing spaces; does not include: 1st & 2nd repeats and variant endings
		 * From the spec: "Abc parsers should be quite liberal in recognizing bar lines. In the wild,
		 * bar lines may have any shape, using a sequence of | (thin bar line), [ or ] (thick bar line),
		 * and : (dots), e.g. |[| or [|:::"
		 *
		 * All the following bar lines are legal, given with most frequently seen first - according to
		 * my limited knowledge of what's out there. AFAIK all but the last 4 are quite commonly seen.
		 * `|`, `:|`, `|:`, `|]`, `||`, `:||:`, `:|:`, `::`, `[|`, `[|]`, `.|`
		 *
		 * Special handling: Uses negative lookahead to prevent capturing `[` when followed by:
		 * - An inline field (e.g., `|[M:3/4]` matches only `|`, not `|[`)
		 * - A variant ending (e.g., `|[1` matches only `|`, not `|[`)
		 *
		 * Strategy: Match `[` only when NOT followed by inline field or digit; match `|` and `]` freely
		 */
		barLine: String.raw`:*\.*(?:[|\]]|\[(?![KLMP]:|[0-9]))*(?:\||::+)(?:[|\]:]|\[(?![KLMP]:|[0-9]))* *`,
	};

/**
 *
 * Get regex for matching ABC music tokens
 *
 * Matches: tuplets, grace notes, inline fields, chord symbols, notes, rests,
 * chords in brackets, decorations, ties, broken rhythms, and variant endings including 1st and 2nd repeats
 *
 * @param {object} options -
 * 	when options.variantEndings is flagged, the returned regex just matches the next variant ending / 1st or 2nd repeat
 * 	when options.inlineField is flagged, the returned regex just matches the next inline field
 * 	when options.barLine is flagged, the returned regex just matches the next bar line
 * 	when options.note is flagged, the returned regex just matches the next note
 * @returns {RegExp} - Regular expression for tokenising ABC music
 */
const getTokenRegex = (options = {}) => {
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

	if (options) {
		if (options.variantEndings)
			return new RegExp(`^${s.variantEnding}|${s.repeat_1Or2}$`);
		if (options.inlineField) return new RegExp(`^${s.inlineField}$`);
		if (options.barLine) return new RegExp(`^${s.barLine}$`);
		if (options.note) return new RegExp(`^${notePattern}$`);
	}

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
		s.variantEnding,
		s.repeat_1Or2,
		s.barLine,
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
	const fieldMatch = token.match(getTokenRegex({ inlineField: true }));
	if (fieldMatch) {
		return {
			field: fieldMatch[1],
			value: fieldMatch[2].trim(),
		};
	}
	return null;
}
module.exports = {
	repeat_1Or2,
	getTokenRegex,
	parseInlineField,
};
