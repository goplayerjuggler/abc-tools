const { Fraction } = require("../math.js");
const {
	getTonalBase,
	getMeter,
	getUnitLength,
	getMusicLines,
} = require("./header-parser.js");
const { parseNote, parseTuplet, NOTE_TO_DEGREE } = require("./note-parser.js");
const { classifyBarLine } = require("./barline-parser.js");
const {
	getTokenRegex,
	parseInlineField,
	analyzeSpacing,
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
// - Grace notes: {ABC}
// - Slurs and ties: (), -
// - Lyrics: w: lines
// - Multiple voices: V: fields
// - Macros and user-defined symbols
// - MIDI directives
// - Stylesheet directives
// - Many header fields (only X, T, M, L, K extracted)
//
// ============================================================================

/**
 * Parse ABC into structured data with bars
 *
 * @param {string} abc - ABC notation string
 * @param {object} options - Parsing options
 * @param {number} options.maxBars - Maximum number of bars to parse (optional)
 * @returns {object} - Parsed structure
 *
 * Returns object with:
 * {
 *   bars: Array<Array<NoteObject>>,  // Array of bars, each bar is array of notes/chords/fields
 *   barLines: Array<BarLineObject>,  // Array of bar line information
 *   unitLength: Fraction,             // The L: field value (default 1/8)
 *   meter: [number, number],          // The M: field value (default [4,4])
 *   tonalBase: string,                // The tonic from K: field (e.g., 'D', 'G')
 *   lineMetadata: Array<LineMetadata>,// Info about original lines (comments, continuations)
 *   headerLines: Array<string>,       // Original header lines
 *   headerEndIndex: number,           // Index where headers end
 *   musicText: string                 // Processed music text (headers removed)
 * }
 *
 * NoteObject structure (regular note):
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
 *   chordNotes: Array<NoteObject> // All notes in the chord (when isChord=true)
 * }
 *
 * NoteObject structure (silence/rest):
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
 * NoteObject structure (dummy note):
 * {
 *   isDummy: true,
 *   duration: Fraction,
 *   token: string,
 *   sourceIndex: number,
 *   sourceLength: number,
 *   spacing: { ... }
 * }
 *
 * NoteObject structure (inline field change):
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
 * NoteObject structure (standalone chord symbol):
 * {
 *   isChordSymbol: true,
 *   chordSymbol: string,        // The chord name
 *   token: string,
 *   sourceIndex: number,
 *   sourceLength: number,
 *   spacing: { ... }
 * }
 *
 * Tuplet structure:
 * {
 *   isTuple: true,
 *   p: number,                  // Tuplet ratio numerator
 *   q: number,                  // Tuplet ratio denominator
 *   r: number,                  // Number of notes in tuplet
 *   token: string,
 *   sourceIndex: number,
 *   sourceLength: number
 * }
 *
 * BarLineObject structure:
 * {
 *   type: string,               // 'regular', 'double', 'final', 'repeat-start', etc.
 *   text: string,               // Original bar line string
 *   isRepeat: boolean,          // Whether this involves repeats
 *   sourceIndex: number,        // Position in musicText
 *   sourceLength: number,       // Length of bar line
 *   barNumber: number,          // Which bar this terminates (0-indexed)
 *   hasLineBreak: boolean,      // Whether there's a newline after this bar line
 *   ending?: number             // For repeat-ending type, which ending (1-6)
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
 *   parseABCWithBars('X:1\nL:1/4\nK:D\n"Dm"D2 [DF]A | ~B4 |]')
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
 *     tonalBase: 'D',
 *     lineMetadata: [...]
 *   }
 */
function parseABCWithBars(abc, options = {}) {
	const { maxBars = Infinity } = options;

	let unitLength = getUnitLength(abc);
	let meter = getMeter(abc);
	let tonalBase = getTonalBase(abc);

	const {
		musicText,
		lineMetadata,
		headerLines,
		headerEndIndex,
		newlinePositions,
	} = getMusicLines(abc);

	// Create a Set of newline positions for O(1) lookup
	const newlineSet = new Set(newlinePositions);

	// Comprehensive bar line regex - includes trailing spaces
	const barLineRegex = /(\|\]|\[\||(\|:?)|(:?\|)|::|(\|[1-6])) */g;

	const bars = [];
	const barLines = [];
	let currentBar = [];
	let barCount = 0;

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

		// Process segment before this bar line
		const segment = musicText.substring(lastBarPos, barLinePos);

		if (segment.trim()) {
			// Parse tokens in this segment
			const tokenRegex = getTokenRegex();

			let tokenMatch;
			let currentTuple = null;

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

				// Check for inline field
				const inlineField = parseInlineField(fullToken);
				if (inlineField) {
					// Update context based on inline field
					if (inlineField.field === "L") {
						const lengthMatch = inlineField.value.match(/1\/(\d+)/);
						if (lengthMatch) {
							unitLength = new Fraction(1, parseInt(lengthMatch[1]));
						}
					} else if (inlineField.field === "M") {
						const meterMatch = inlineField.value.match(/(\d+)\/(\d+)/);
						if (meterMatch) {
							meter = [parseInt(meterMatch[1]), parseInt(meterMatch[2])];
						}
					} else if (inlineField.field === "K") {
						const keyMatch = inlineField.value.match(/^([A-G])/);
						if (keyMatch) {
							tonalBase = keyMatch[1].toUpperCase();
						}
					}

					currentBar.push({
						isInlineField: true,
						field: inlineField.field,
						value: inlineField.value,
						token: fullToken,
						sourceIndex: tokenStartPos,
						sourceLength: fullToken.length,
						spacing,
					});
					continue;
				}

				// Tuplets
				if (fullToken.match(/\(\d(?::\d?){0,2}/g)) {
					const tuple = parseTuplet(fullToken);
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
					continue;
				}

				// Regular note, rest, or dummy, or chord in brackets
				const note = parseNote(fullToken, unitLength, currentTuple);
				if (note) {
					currentBar.push({
						...note,
						token: fullToken,
						sourceIndex: tokenStartPos,
						sourceLength: fullToken.length,
						spacing,
					});
				}
			}
		}

		// Check if bar line has a newline after it
		const barLineEndPos = barLinePos + barLineText.length;
		const hasLineBreakAfterBar =
			newlineSet.has(barLineEndPos + 1) ||
			(barLineEndPos < musicText.length && musicText[barLineEndPos] === "\n");

		// Store bar line information
		const barLineInfo = classifyBarLine(barLineText);
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
		tonalBase,
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
 * @param {object} parsedData - Output from parseABCWithBars
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

module.exports = {
	parseABCWithBars,
	calculateBarDurations,
	// Re-export utilities for convenience
	getTonalBase,
	getMeter,
	getUnitLength,
	getMusicLines,
	analyzeSpacing,
	classifyBarLine,
	NOTE_TO_DEGREE,
};
