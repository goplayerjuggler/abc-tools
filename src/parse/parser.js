const { Fraction } = require("../math.js");
const {
	getTonalBase,
	getMeter,
	getUnitLength,
	getMusicLines,
} = require("./header-parser.js");
const {
	parseNote,
	parseBrokenRhythm,
	applyBrokenRhythm,
	parseGraceNotes,
} = require("./note-parser.js");
const { parseBarLine } = require("./barline-parser.js");
const {
	analyzeSpacing,
	getTokenRegex,
	parseInlineField,
	parseTuplet,
} = require("./token-utils.js");

// ============================================================================
// ABC PARSER - MAIN MODULE
// ============================================================================
//
// Main parsing entry point that orchestrates the parsing of ABC notation
// into structured bar data. This module coordinates the header parsing,
// note parsing, and bar line processing.
//
// SUPPORTED FEATURES (ABC v2.1):
// - Basic note notation (pitch, octave markers, accidentals)
// - Duration modifiers (explicit numbers, fractions, slashes)
// - Rests/silences (z, x)
// - Dummy note: y (for spacing/alignment)
// - Back quotes: ` (ignored spacing for legibility, preserved in metadata)
// - Triplets: (3ABC, (3A/B/C/, (3A2B2C2
// - Broken rhythms: A>B, C<<D, etc. (>, >>, >>>, <, <<, <<<)
// - Grace notes: {ABC}, {^AB_c}, etc. (zero duration, transparent to broken rhythms)
// - Repeat notation: |:, :|, |1, |2, etc.
// - Bar lines: |, ||, |], [|, etc.
// - Decorations: symbol decorations (~.MPSTHUV) and !name! decorations
// - Chord symbols: "Dm7", "G", etc.
// - Chords (multiple notes): [CEG], [CEG]2, etc.
// - Annotations: "^text", "<text", etc. (parsed but position markers preserved)
// - Inline fields: [K:...], [L:...], [M:...], [P:...]
// - Inline comments: % comment text
// - Line continuations: \ at end of line
// - Beaming: tracks whitespace between notes for beam grouping
// - Line breaks: preserves information about newlines in music
//
// NOT YET SUPPORTED:
// - Slurs: ()
// - Lyrics: w: lines
// - Multiple voices: V: fields
// - Macros and user-defined symbols
// - MIDI directives
// - Stylesheet directives
// - Many header fields (only X, T, M, L, K extracted)
//
// ============================================================================

/**
 * Parse ABC into structured data
 *
 * @param {string} abc - ABC notation string
 * @param {object} options - Parsing options
 * @param {number} options.maxBars - Maximum number of bars to parse (optional)
 * @returns {object} - Parsed structure
 *
 * Returns object with:
 * {
 *   bars: Array<Array<ScoreObject>>,  // Array of bars, each bar is array of ScoreObjects
 * 		// A Score object is almost anything that isn’t a bar line: note/chord/field/broken rhythm/tuplet/1st or 2nd repeat or variant ending
 *   barLines: Array<BarLineObject>,  // Array of bar line information
 *   unitLength: Fraction,             // The L: field value (default 1/8)
 *   meter: [number, number],          // The M: field value (default [4,4])
 *   lineMetadata: Array<LineMetadata>,// Info about original lines (comments, continuations)
 *   headerLines: Array<string>,       // Original header lines
 *   headerEndIndex: number,           // Index where headers end
 *   musicText: string                 // Processed music text (headers removed)
 * }
 *
 * ScoreObject structure (normal note):
 * {
 *   pitch: string,              // 'A'-'G' (uppercase for low octave, lowercase for middle)
 *   octave: number,             // Relative octave offset (0 = middle, +1 = high, -1 = low)
 *   duration: Fraction,         // Note duration as fraction of whole note
 *   isSilence: boolean,         // Always false for pitched notes
 *   tied: boolean,              // The ABC fragment `A-B` maps to [note1, note2] with note1.tied === true
 *   token: string,              // Original ABC token (e.g., 'D2', '^F/')
 *   sourceIndex: number,        // Position in musicText where token starts
 *   sourceLength: number,       // Length of original token
 *   spacing: {                  // Whitespace/beaming info after this token
 *     whitespace: string,       // Actual whitespace characters (back quotes removed)
 *     backquotes: number,       // Number of ` characters for reconstruction
 *     beamBreak: boolean,       // True if beam should break (multiple spaces/newline)
 *     lineBreak: boolean        // True if there was a newline after this token
 *   },
 *
 *   // Optional properties (only present if applicable):
 *   decorations: Array<string>, // e.g., ['trill', 'staccato']
 *   chordSymbol: string,        // e.g., 'Dm7', 'G'
 *   annotation: {               // Text annotation with position
 *     position: string,         // '^' (above), '_' (below), '<' (left), '>' (right), '@' (auto)
 *     text: string
 *   },
 *   isChord: true,              // Present if this is a chord [CEG]
 *   chordNotes: Array<ScoreObject>, // All notes in the chord (when isChord=true)
 *   isGraceNote: true           // Present if this is a grace note (has zero duration)
 * }
 *
 * ScoreObject structure (silence/rest):
 * {
 *   isSilence: true,
 *   duration: Fraction,
 *   token: string,
 *   sourceIndex: number,
 *   sourceLength: number,
 *   spacing: { ... },           // Same as regular note
 *   // Optional: decorations, chordSymbol, annotation (same as above)
 * }
 *
 * ScoreObject structure (dummy note):
 * {
 *   isDummy: true,
 *   duration: Fraction,
 *   token: string,
 *   sourceIndex: number,
 *   sourceLength: number,
 *   spacing: { ... }
 * }
 *
 * ScoreObject structure (inline field change):
 * {
 *   isInlineField: true,
 *   field: string,              // 'K', 'L', 'M', or 'P'
 *   value: string,              // The field value (e.g., 'G major', '3/4')
 *   token: string,              // Original token (e.g., '[K:G]')
 *   sourceIndex: number,
 *   sourceLength: number,
 *   spacing: { ... }
 * }
 *
 * ScoreObject structure (standalone chord symbol):
 * {
 *   isChordSymbol: true,
 *   chordSymbol: string,        // The chord name
 *   token: string,
 *   sourceIndex: number,
 *   sourceLength: number,
 *   spacing: { ... }
 * }
 *
 * ScoreObject structure (Tuplet):
 * {
 *   isTuple: true,
 *   p: number,                  // Tuplet ratio numerator
 *   q: number,                  // Tuplet ratio denominator
 *   r: number,                  // Number of notes in tuplet
 *   token: string,
 *   sourceIndex: number,
 *   sourceLength: number,
 *   spacing: { ... }
 * }
 *
 * ScoreObject structure ((BrokenRhythm):
 * {
 *   isBrokenRhythm: true,
 *   direction: string,          // '>' or '<'
 *   dots: number,               // 1, 2, or 3
 *   token: string,
 *   sourceIndex: number,
 *   sourceLength: number,
 *   spacing: { ... }
 * }
 *
 * BarLineObject structure:
 * {
 *   text: string,               // Original bar line string
 *   trimmed: string,            // trimmed bar line string
 *   isSectionBreak,              // double bars and repeats are section breaks
 *   isRepeatL: boolean,
 * // true iff there’s a repeat to the left of the bar line; if not the property is omitted
 * // indicates the end of a repeated section
 *   isRepeatR: boolean,
 * // true iff there’s a repeat to the right of the bar line; if not the property is omitted
 * // indicates the start of a repeated section
 *   sourceIndex: number,        // Position in musicText
 *   sourceLength: number,       // Length of bar line
 *   hasLineBreak: boolean,      // Whether there's a newline after this bar line
 * }
 *
 * LineMetadata structure:
 * {
 *   lineIndex: number,          // Original line number in ABC
 *   originalLine: string,       // Complete original line from ABC
 *   content: string,            // Line content (comments/continuations removed)
 *   comment: string | null,     // Text after % (null if no comment)
 *   hasContinuation: boolean    // Whether line had \ continuation marker
 * }
 *
 * Example:
 *   parseAbc('X:1\nL:1/4\nK:D\n"Dm"D2 [DF]A | ~B4 |]')
 *   // Returns:
 *   {
 *     bars: [
 *       [
 *         { isChordSymbol: true, chordSymbol: 'Dm', spacing: {...}, ... },
 *         { pitch: 'D', octave: 0, duration: Fraction(1,2), chordSymbol: 'Dm', spacing: {...}, ... },
 *         { pitch: 'F', octave: 0, duration: Fraction(1,4), isChord: true, chordNotes: [...], spacing: {...}, ... },
 *         { pitch: 'A', octave: 0, duration: Fraction(1,4), spacing: {...}, ... }
 *       ],
 *       [
 *         { pitch: 'B', octave: 0, duration: Fraction(1,1), decorations: ['roll'], spacing: {...}, ... }
 *       ]
 *     ],
 *     barLines: [...],
 *     unitLength: Fraction(1,4),
 *     meter: [4,4],
 *     lineMetadata: [...]
 *   }
 */
function parseAbc(abc, options = {}) {
	const { maxBars = Infinity } = options;

	const unitLength = getUnitLength(abc);
	const meter = getMeter(abc);

	const {
		musicText,
		lineMetadata,
		headerLines,
		headerEndIndex,
		newlinePositions,
	} = getMusicLines(abc);

	// Create a Set of newline positions for O(1) lookup
	const newlineSet = new Set(newlinePositions);

	/*
	Bar line regex - includes trailing spaces; does not include: 1st & 2nd repeats and variant endings - tokenised by tokenRegex below
	From the spec: "Abc parsers should be quite liberal in recognizing bar lines. In the wild, bar lines may have any shape, using a sequence of | (thin bar line), [ or ] (thick bar line), and : (dots), e.g. |[| or [|:::"
	All the following bar lines are legal, given with most frequently seen first - according to my limited knowledge of what’s out there. AFAIK all but the last 4 are quite commonly seen.
	`|`, `:|`, `|:`, `|]`, `||`, `:||:`, `:|:`, `::`, `[|`, `[|]`, `.|`
	*/
	const barLineRegex = /:*\.*[|[\]]*(?:\||::+)[|[\]]*:* */g; //captures expressions with at least one `|`, or at least two `:`.

	const bars = [];
	const barLines = [];
	let currentBar = [];
	let barCount = 0;
	let previousRealNote = null; // Track last non-grace note for broken rhythms

	// Split music text by bar lines while preserving positions
	let lastBarPos = 0;
	let match;
	let first = true;

	while ((match = barLineRegex.exec(musicText)) !== null || first) {
		first = false;
		const { barLineText, barLinePos } =
			match === null
				? { barLineText: musicText, barLinePos: musicText.length }
				: {
						barLineText: match[0],
						barLinePos: match.index,
				  };

		if (lastBarPos > 0) lastBarPos--; //the last character in a barline expression may be needed to match variant endings - eg `|1`
		// Process segment before this bar line
		const segment = musicText.substring(lastBarPos, barLinePos);

		if (segment.trim()) {
			// Parse tokens in this segment
			const tokenRegex = getTokenRegex();

			let tokenMatch;
			let currentTuple = null;
			// let previousNote = null; // Track previous note for broken rhythms

			while ((tokenMatch = tokenRegex.exec(segment)) !== null) {
				// Check if all notes of the tuple have been parsed
				if (currentTuple && currentTuple.r === 0) {
					currentTuple = null;
				}
				const fullToken = tokenMatch[0];
				const tokenStartPos = lastBarPos + tokenMatch.index;
				const spacing = analyzeSpacing(
					segment,
					tokenMatch.index + fullToken.length
				);

				if (fullToken.match(getTokenRegex({ variantEndings: true }))) {
					const variantEnding = {
						isVariantEnding: true,
						token: fullToken,
						sourceIndex: tokenStartPos,
						sourceLength: fullToken.length,
						spacing,
					};
					currentBar.push(variantEnding);

					continue;
				}

				// Check for grace notes
				if (fullToken.startsWith("{")) {
					const graceNotes = parseGraceNotes(fullToken);
					if (graceNotes) {
						// Add each grace note to the bar
						graceNotes.forEach((graceNote, idx) => {
							currentBar.push({
								...graceNote,
								token: fullToken,
								sourceIndex: tokenStartPos,
								sourceLength: fullToken.length,
								// Only the last grace note gets the spacing
								spacing:
									idx === graceNotes.length - 1
										? spacing
										: {
												whitespace: "",
												backquotes: 0,
												beamBreak: false,
												lineBreak: false,
										  },
							});
						});
						// Grace notes don't update previousRealNote
						continue;
					}
				}

				// Check for inline field
				const inlineField = parseInlineField(fullToken);
				if (inlineField) {
					const inlineFieldObj = {
						isInlineField: true,
						field: inlineField.field,
						value: inlineField.value,
						token: fullToken,
						sourceIndex: tokenStartPos,
						sourceLength: fullToken.length,
						spacing,
					};
					currentBar.push(inlineFieldObj);
					previousRealNote = null; // Inline fields break note sequences
					continue;
				}

				// Check for broken rhythm
				const brokenRhythm = parseBrokenRhythm(fullToken);
				if (brokenRhythm) {
					if (previousRealNote) {
						// Find the next REAL note token (skip grace notes)
						let nextTokenMatch = tokenRegex.exec(segment);
						while (nextTokenMatch) {
							const nextToken = nextTokenMatch[0];
							// Skip grace notes
							if (nextToken.startsWith("{")) {
								nextTokenMatch = tokenRegex.exec(segment);
								continue;
							}
							break;
						}

						if (nextTokenMatch) {
							const nextToken = nextTokenMatch[0];
							const nextTokenStartPos = lastBarPos + nextTokenMatch.index;
							const nextSpacing = analyzeSpacing(
								segment,
								nextTokenMatch.index + nextToken.length
							);

							// Parse the next note
							const nextNote = parseNote(nextToken, unitLength, currentTuple);
							if (nextNote && nextNote.duration && previousRealNote.duration) {
								// Apply broken rhythm to both notes
								applyBrokenRhythm(previousRealNote, nextNote, brokenRhythm);

								// Add the broken rhythm marker to the bar
								currentBar.push({
									...brokenRhythm,
								});

								// Add the next note to the bar
								const nextNoteObj = {
									...nextNote,
									token: nextToken,
									sourceIndex: nextTokenStartPos,
									sourceLength: nextToken.length,
									spacing: nextSpacing,
								};
								currentBar.push(nextNoteObj);
								previousRealNote = null; //can't have successive broken rhythms
								continue;
							}
						}
					}
					// If we couldn't apply the broken rhythm, just skip it
					previousRealNote = null;
					continue;
				}

				// Tuplets
				if (fullToken.match(/\(\d(?::\d?){0,2}/g)) {
					const isCompound =
						meter &&
						meter[1] === 8 &&
						[6, 9, 12, 15, 18].indexOf(meter[0]) >= 0;
					const tuple = parseTuplet(fullToken, isCompound);
					if (tuple) {
						if (currentTuple) {
							throw new Error("nested tuples not handled");
						}
						currentTuple = tuple;
						currentBar.push({
							...tuple,
							token: fullToken,
							sourceIndex: tokenStartPos,
							sourceLength: fullToken.length,
						});
						previousRealNote = null; // Tuplet markers break note sequences
						continue;
					}
				}

				// Standalone chord symbol
				if (fullToken.match(/^"[^"]+"$/)) {
					currentBar.push({
						isChordSymbol: true,
						chordSymbol: fullToken.slice(1, -1),
						token: fullToken,
						sourceIndex: tokenStartPos,
						sourceLength: fullToken.length,
						spacing,
					});
					// Chord symbols don't break note sequences
					continue;
				}

				// Standalone decoration
				if (fullToken.match(/^!([^!]+)!$/)) {
					currentBar.push({
						isDecoration: true,
						decoration: fullToken.slice(1, -1),
						token: fullToken,
						sourceIndex: tokenStartPos,
						sourceLength: fullToken.length,
						spacing,
					});
					// Decorations don't break note sequences
					continue;
				}

				// Regular note, rest, or dummy, or chord in brackets
				const note = parseNote(fullToken, unitLength, currentTuple);
				if (note) {
					const noteObj = {
						...note,
						token: fullToken,
						sourceIndex: tokenStartPos,
						sourceLength: fullToken.length,
						spacing,
					};
					currentBar.push(noteObj);
					// Only track as previous note if it has non-zero duration (for broken rhythms)
					if (note.duration && note.duration.n !== 0) {
						previousRealNote = noteObj;
					}
				}
			}
		}

		// Check if bar line has a newline after it
		const barLineEndPos = barLinePos + barLineText.length;
		const hasLineBreakAfterBar =
			newlineSet.has(barLineEndPos + 1) ||
			(barLineEndPos < musicText.length && musicText[barLineEndPos] === "\n");

		// Store bar line information
		const barLineInfo = parseBarLine(barLineText);
		barLines.push({
			...barLineInfo,
			sourceIndex: barLinePos,
			sourceLength: barLineText.length,
			barNumber: barCount,
			hasLineBreak: hasLineBreakAfterBar,
		});

		// Update the last token in current bar to mark lineBreak if bar line has one
		if (currentBar.length > 0 && hasLineBreakAfterBar) {
			const lastToken = currentBar[currentBar.length - 1];
			if (lastToken.spacing) {
				lastToken.spacing.lineBreak = true;
			}
		}

		// Save current bar if it has content
		if (currentBar.length > 0) {
			bars.push(currentBar);
			barCount++;
			currentBar = [];
			previousRealNote = null; // Bar lines break note sequences

			// Check if we've reached max bars
			if (barCount >= maxBars) {
				break;
			}
		}

		lastBarPos = barLineEndPos;
	}

	// Add final bar if it has content and we haven't reached max
	if (currentBar.length > 0 && barCount < maxBars) {
		bars.push(currentBar);
	}

	return {
		bars,
		barLines,
		unitLength,
		meter,
		lineMetadata,
		headerLines,
		headerEndIndex,
		musicText,
	};
}

/**
 * Calculate bar durations from parsed ABC data
 * Returns duration for each bar as a Fraction
 *
 * @param {object} parsedData - Output from parseAbc
 * @returns {Array<Fraction>} - Array of bar durations
 */
function calculateBarDurations(parsedData) {
	const { bars, barLines } = parsedData;
	const result = [];

	// If there's a bar line at the start, add a zero-duration entry
	if (barLines && barLines[0] && barLines[0].sourceIndex === 0) {
		result.push(new Fraction(0, 1));
	}

	bars.forEach((bar) => {
		let total = new Fraction(0, 1);
		for (const note of bar) {
			if (!note.duration) {
				continue;
			}
			total = total.add(note.duration);
		}
		result.push(total);
	});

	return result;
}

/**
 * Extracts all ABC music notation tunes from a string.
 *
 * @param {string} text - The input string containing one or more ABC tunes
 * @returns {string[]} An array of ABC tune strings, each containing a complete tune
 * @throws {TypeError} If the input is not a string
 *
 * @example
 * const abcText = `X: 1
 * T: Example Tune
 * M: 4/4
 * K: C
 * CDEF|
 *
 * X: 2
 * T: Another Tune
 * K: G
 * GABc|`;
 *
 * const tunes = getTunes(abcText);
 * // Returns: ['X: 1\nT: Example Tune\nM: 4/4\nK: C\nCDEF|', 'X: 2\nT: Another Tune\nK: G\nGABc|']
 */
function getTunes(text) {
	if (typeof text !== "string") {
		throw new TypeError("Input must be a string");
	}
	// Regex pattern to match ABC tunes:
	// ^X:\s*\d+   - Matches lines starting with "X:" followed by optional whitespace and digits
	// .*$         - Matches the rest of that line
	// (?:\n(?!\n).*)* - Matches subsequent lines that are NOT empty lines (non-capturing group)
	//                   \n(?!\n) ensures we have a newline NOT followed by another newline
	//                   .* matches the content of that non-empty line
	//                   * repeats for all consecutive non-empty lines
	// Flags: g (global), m (multiline)
	const getAbc = /^X:\s*\d+.*$(?:\n(?!\n).*)*$/gm;
	// Extract all matches and return as an array of strings
	const matches = [...text.matchAll(getAbc)];

	return matches.map((match) => match[0]);
}

module.exports = {
	getTunes,
	parseAbc,
	calculateBarDurations,
	// Re-export utilities for convenience
	getTonalBase,
	getMeter,
	getUnitLength,
	getMusicLines,
	analyzeSpacing,
	parseBarLine,
};
