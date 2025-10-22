const { Fraction } = require("../math.js");

// ============================================================================
// ABC NOTE PARSING
// ============================================================================
//
// Handles parsing of individual notes, chords, rests, and related elements:
// - Pitch and octave extraction
// - Duration calculation
// - Chord parsing (multiple notes in brackets)
// - Decorations/ornaments
// - Chord symbols and annotations
// - Tuplets/triplets
//
// ============================================================================

// Note degree mapping for chord topmost note detection
const NOTE_TO_DEGREE = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

/**
 * Parse decorations/ornaments from a token
 *
 * @param {string} noteStr - Note token string
 * @returns {Array<string>|null} - Array of decoration names, or null if none found
 */
function parseDecorations(noteStr) {
	const decorations = [];

	// Symbol decorations (prefix the note)
	const symbolDecorations = {
		"~": "roll",
		".": "staccato",
		M: "lowermordent",
		P: "uppermordent",
		S: "segno",
		T: "trill",
		H: "fermata",
		u: "upbow",
		v: "downbow",
	};

	for (const [symbol, name] of Object.entries(symbolDecorations)) {
		if (noteStr.includes(symbol)) {
			decorations.push(name);
		}
	}

	// !decoration! style (can be anywhere in string)
	const bangDecorations = noteStr.match(/!([^!]+)!/g);
	if (bangDecorations) {
		bangDecorations.forEach((dec) => {
			const name = dec.slice(1, -1); // Remove ! marks
			decorations.push(name);
		});
	}

	return decorations.length > 0 ? decorations : null;
}

/**
 * Parse chord symbols from a token
 *
 * @param {string} noteStr - Note token string
 * @returns {string|null} - Chord symbol string (e.g., 'Dm7', 'G'), or null if none found
 */
function parseChordSymbol(noteStr) {
	const chordMatch = noteStr.match(/"([^"]+)"/);
	return chordMatch ? chordMatch[1] : null;
}

/**
 * Parse annotations from a token
 *
 * @param {string} noteStr - Note token string
 * @returns {object|null} - Annotation object with position and text, or null if none found
 */
function parseAnnotation(noteStr) {
	// Annotations can be in quotes with position markers like "^text" or "<text"
	const annotationMatch = noteStr.match(/"([<>^_@])([^"]+)"/);
	if (annotationMatch) {
		return {
			position: annotationMatch[1],
			text: annotationMatch[2],
		};
	}
	return null;
}

/**
 * Strip decorations, chords, and annotations from a note string
 * Returns clean note string for duration/pitch parsing
 *
 * @param {string} noteStr - Note token string
 * @returns {string} - Cleaned note string
 */
function stripExtras(noteStr) {
	return noteStr
		.replace(/!([^!]+)!/g, "") // Remove !decorations!
		.replace(/"[^"]*"/g, "") // Remove "chords" and "annotations"
		.replace(/[~.MPSTHUV]/g, ""); // Remove symbol decorations
}

/**
 * Extract pitch and octave from a note string
 *
 * @param {string} pitchStr - Note string (may include octave markers)
 * @returns {object|null} - { pitch, octave } or null if no pitch found
 */
function getPitch(pitchStr) {
	const pitchMatch = pitchStr.match(/[A-Ga-g]/);
	if (!pitchMatch) {
		return null;
	}

	const pitch = pitchMatch[0];

	// Count octave modifiers
	const upOctaves = (pitchStr.match(/'/g) || []).length;
	const downOctaves = (pitchStr.match(/,/g) || []).length;
	const octave = upOctaves - downOctaves;
	return { pitch, octave };
}

/**
 * Calculate note duration from ABC notation
 *
 * @param {object} options
 * @param {Fraction} options.unitLength - Unit note length from L: field
 * @param {string} options.noteString - Note string including duration modifiers
 * @param {object} options.currentTuple - Current tuplet context (if any)
 * @returns {Fraction} - Note duration as fraction of whole note
 */
function getDuration({ unitLength, noteString, currentTuple } = {}) {
	// Parse duration as Fraction
	let duration = unitLength.clone();

	// Handle explicit fractions (e.g., '3/2', '2/4', '/4')
	const fracMatch = noteString.match(/(\d+)?\/(\d+)/);
	if (fracMatch) {
		const n = fracMatch[1] ? parseInt(fracMatch[1]) : 1;
		duration = unitLength.multiply(n).divide(parseInt(fracMatch[2]));
	} else {
		// Handle explicit multipliers (e.g., '2', '3')
		const multMatch = noteString.match(/(\d+)(?!'[/]')/);
		if (multMatch) {
			duration = duration.multiply(parseInt(multMatch[1]));
		}

		// Handle divisions (e.g., '/', '//', '///')
		const divMatch = noteString.match(/\/+/);
		if (divMatch) {
			const slashes = divMatch[0].length;
			duration = duration.divide(Math.pow(2, slashes));
		}
	}

	if (currentTuple) {
		duration = duration.divide(currentTuple.p).multiply(currentTuple.q);
		currentTuple.r--;
	}
	return duration;
}

/**
 * Parse a chord (multiple notes in brackets)
 *
 * @param {string} chordStr - Chord string (e.g., '[CEG]', '[DF]2', '[D2F2]')
 * @param {Fraction} unitLength - Unit note length
 * @returns {object|null} - { isChord: true, notes: Array<NoteObject> } or null if not a valid chord
 */
function parseChord(chordStr, unitLength) {
	if (!chordStr.startsWith("[") || !chordStr.endsWith("]")) {
		return null;
	}

	// Split into individual notes
	const noteMatches = chordStr.match(/[=^_]?[A-Ga-g][',]*/g);
	if (!noteMatches) {
		return null;
	}

	const notes = [];
	for (const noteStr of noteMatches) {
		const note = getPitch(noteStr, unitLength);
		if (note) {
			notes.push(note);
		}
	}
	return {
		isChord: true,
		notes,
	};
}

/**
 * Parse ABC note to extract pitch, octave, duration, and metadata
 * For chords in brackets, extracts the topmost note for melody contour analysis
 *
 * @param {string} noteStr - Note token string
 * @param {Fraction} unitLength - Unit note length from L: field
 * @param {object} currentTuple - Current tuplet context (if any)
 * @returns {object} - NoteObject with pitch, octave, duration, and optional metadata
 */
function parseNote(noteStr, unitLength, currentTuple) {
	// Extract metadata before stripping
	const decorations = parseDecorations(noteStr);
	const chordSymbol = parseChordSymbol(noteStr);
	const annotation = parseAnnotation(noteStr);

	// Strip extras for core parsing
	const cleanStr = stripExtras(noteStr);

	// Handle dummy note 'y' (invisible placeholder)
	if (cleanStr.match(/^y$/)) {
		return {
			isDummy: true,
			duration: new Fraction(0, 1, decorations, annotation),
		};
	}

	// rest/silence
	const silenceMatch = cleanStr.match(/^[zx]/);
	if (silenceMatch) {
		const duration = getDuration({
			unitLength,
			noteString: cleanStr,
			currentTuple,
		});
		const result = { isSilence: true, duration, text: silenceMatch[0] };
		if (decorations) {
			result.decorations = decorations;
		}
		if (chordSymbol) {
			result.chordSymbol = chordSymbol;
		}
		if (annotation) {
			result.annotation = annotation;
		}
		return result;
	}

	// Handle ties
	const tied = !!cleanStr.match(/-$/);

	// Handle chords - extract topmost note for contour sorting
	if (cleanStr.match(/^\[.*\]/)) {
		const chord = parseChord(noteStr, unitLength);
		if (chord && chord.notes && chord.notes.length > 0) {
			// Find topmost note (highest pitch + octave)
			let topNote = chord.notes[0];
			for (const note of chord.notes) {
				if (note.isSilence) {
					continue;
				}
				const topPos =
					(topNote.octave || 0) * 7 +
					(NOTE_TO_DEGREE[topNote.pitch?.toUpperCase()] || 0);
				const notePos =
					(note.octave || 0) * 7 +
					(NOTE_TO_DEGREE[note.pitch?.toUpperCase()] || 0);
				if (notePos > topPos) {
					topNote = note;
				}
			}

			const duration = getDuration({
				unitLength,
				noteString: cleanStr,
				currentTuple,
			});
			topNote.duration = duration;
			// Apply duration to all notes in chord
			chord.notes.forEach((note) => {
				note.duration = duration;
			});
			// Return top note with chord metadata
			return {
				...topNote,
				annotation,
				chordNotes: chord.notes,
				chordSymbol: chordSymbol || chord.chordSymbol,
				decorations: decorations || chord.decorations,
				isChord: true,
				tied,
			};
		}
	}

	// single note
	const { pitch, octave } = getPitch(cleanStr);

	const duration = getDuration({
		unitLength,
		noteString: cleanStr,
		currentTuple,
	});

	const result = { pitch, octave, duration, tied };
	if (decorations) {
		result.decorations = decorations;
	}
	if (chordSymbol) {
		result.chordSymbol = chordSymbol;
	}
	if (annotation) {
		result.annotation = annotation;
	}
	return result;
}

/**
 * Parse tuplet notation from a token
 *
 * @param {string} token - Tuplet token (e.g., '(3', '(3:2', '(3:2:4')
 * @param {boolean} isCompoundTimeSignature - Whether current time signature is compound (affects default q value)
 * @returns {object|null} - { isTuple: true, p, q, r } or null if not a valid tuplet
 */
function parseTuplet(token, isCompoundTimeSignature) {
	const tupleMatch = token.match(/^\(([2-9])(?::(\d)?)?(?::(\d)?)?$/);
	if (tupleMatch) {
		const pqr = {
			p: parseInt(tupleMatch[1]),
			q: tupleMatch[2],
			r: tupleMatch[3],
		};
		const { p } = pqr;
		let { q, r } = pqr;
		if (q) {
			q = parseInt(q);
		} else {
			switch (p) {
				case 2:
					q = 3;
					break;
				case 3:
					q = 2;
					break;
				case 4:
					q = 3;
					break;
				case 5:
				case 7:
				case 9:
					q = isCompoundTimeSignature ? 3 : 2;
					break;
				case 6:
					q = 2;
					break;
				case 8:
					q = 3;
					break;
			}
		}
		if (r) {
			r = parseInt(r);
		} else {
			r = p;
		}
		return {
			isTuple: true,
			p,
			q,
			r,
		};
	}
	return null;
}

module.exports = {
	parseDecorations,
	parseChordSymbol,
	parseAnnotation,
	stripExtras,
	getPitch,
	getDuration,
	parseChord,
	parseNote,
	parseTuplet,
	NOTE_TO_DEGREE,
};
