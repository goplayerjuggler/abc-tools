/**
 * Accidental handling helpers for toggleMeterDoubling
 * Uses existing parsed token structure from parseAbc
 */

/**
 * Extract accidentals implied by a key signature
 * @param {string} keyHeader - The K: header value (e.g., "D dorian", "F# minor")
 * @param {Function} normaliseKey - The normaliseKey function from manipulator.js
 * @returns {Map<string, string>} - Map of note letter to accidental ('^', '_', or null for natural)
 */
function getKeySignatureAccidentals(keyHeader, normaliseKey) {
	// Parse key using existing normaliseKey
	const parsed = normaliseKey(keyHeader);
	const tonic = parsed[0];
	const mode = parsed[1];

	// Remove unicode accidentals from tonic to get base note
	const baseNote = tonic.replace(/[♯♭]/g, "");
	const tonicAccidental =
		tonic.length > 1 ? (tonic.includes("♯") ? "^" : "_") : null;

	// Semitone positions for each natural note
	const noteValues = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

	// Mode patterns (semitones from tonic)
	const modePatterns = {
		major: [0, 2, 4, 5, 7, 9, 11], // Ionian
		minor: [0, 2, 3, 5, 7, 8, 10], // Aeolian
		mixolydian: [0, 2, 4, 5, 7, 9, 10],
		dorian: [0, 2, 3, 5, 7, 9, 10],
		phrygian: [0, 1, 3, 5, 7, 8, 10],
		lydian: [0, 2, 4, 6, 7, 9, 11],
		locrian: [0, 1, 3, 5, 6, 8, 10]
	};

	const pattern = modePatterns[mode] || modePatterns.major;
	const notes = ["C", "D", "E", "F", "G", "A", "B"];

	// Calculate tonic's actual semitone position
	let tonicValue = noteValues[baseNote];
	if (tonicAccidental === "^") tonicValue = (tonicValue + 1) % 12;
	if (tonicAccidental === "_") tonicValue = (tonicValue + 11) % 12;

	// Build the scale and determine accidentals
	const accidentals = new Map();
	for (let i = 0; i < 7; i++) {
		const noteLetter = notes[(notes.indexOf(baseNote) + i) % 7];
		const expectedValue = (tonicValue + pattern[i]) % 12;
		const naturalValue = noteValues[noteLetter];

		const diff = (expectedValue - naturalValue + 12) % 12;
		if (diff === 1) {
			accidentals.set(noteLetter, "^"); // Sharp
		} else if (diff === 11) {
			accidentals.set(noteLetter, "_"); // Flat
		}
		// diff === 0 means natural (no entry)
	}

	return accidentals;
}

/**
 * Extract accidental and note information from a parsed note token
 * Handles regular notes and chords in brackets
 *
 * @param {object} token - Parsed token object from parseAbc
 * @returns {Array<object>} - Array of {noteLetter, octaveMarkers, accidental} objects
 */
function extractNoteInfo(token) {
	if (!token.pitch) return [];

	const result = [];

	// Handle chord in brackets [CEG]
	if (token.isChord && token.chordNotes) {
		// Process each note in the chord
		for (const chordNote of token.chordNotes) {
			const info = extractNoteInfo(chordNote);
			result.push(...info);
		}
		return result;
	}

	// Regular note - extract from the token string
	// Format: [decorations][accidental]pitch[octave][duration][tie]
	// We need to extract the accidental, pitch letter, and octave markers

	const tokenStr = token.token;

	// Match pattern: optional accidental (=, ^, _, ^^, __) followed by pitch followed by octave markers
	const noteMatch = tokenStr.match(/(__|_|=|\^\^|\^)?([A-Ga-g])([',]*)/);

	if (noteMatch) {
		const accidental = noteMatch[1] || null;
		const noteLetter = noteMatch[2];
		const octaveMarkers = noteMatch[3] || "";

		result.push({
			noteLetter,
			octaveMarkers,
			accidental,
			noteWithOctave: noteLetter + octaveMarkers
		});
	}

	return result;
}

/**
 * Track accidentals in effect within a bar using parsed tokens
 * @param {Array<object>} barTokens - Array of parsed tokens from a bar
 * @param {Map<string, string>} keyAccidentals - Accidentals from key signature
 * @returns {Map<string, string>} - Map of note (with octave) to its current accidental state
 */
function getBarAccidentals(barTokens, keyAccidentals) {
	const accidentals = new Map();

	for (const token of barTokens) {
		// Skip non-note tokens
		if (
			token.isSilence ||
			token.isDummy ||
			token.isInlineField ||
			token.isChordSymbol ||
			token.isTuple ||
			token.isBrokenRhythm ||
			token.isVariantEnding ||
			token.isDecoration ||
			token.isGraceNote
		) {
			continue;
		}

		const noteInfos = extractNoteInfo(token);

		for (const {
			noteLetter,
			octaveMarkers,
			accidental,
			noteWithOctave
		} of noteInfos) {
			const baseNoteLetter = noteLetter.toUpperCase();

			if (accidental) {
				// Explicit accidental - record it
				accidentals.set(noteWithOctave, accidental);
			} else if (!accidentals.has(noteWithOctave)) {
				// No explicit accidental, use key signature default
				const keyAccidental = keyAccidentals.get(baseNoteLetter) || null;
				accidentals.set(noteWithOctave, keyAccidental);
			}
			// If accidental already set for this note in this bar, it carries over
		}
	}

	return accidentals;
}

/**
 * Add correct accidentals when merging bars
 * Modifies the tokens in the second bar to add accidentals where needed
 *
 * @param {Array<object>} secondBarTokens - Array of parsed tokens from second bar
 * @param {Map<string, string>} firstBarAccidentals - Accidentals in effect from first bar
 * @param {Map<string, string>} keyAccidentals - Accidentals from key signature
 * @param {string} musicText - Original music text for reconstruction
 * @returns {Array<object>} - Modified tokens with accidentals added
 */
function addAccidentalsForMergedBar(
	secondBarTokens,
	firstBarAccidentals,
	keyAccidentals,
	musicText
) {
	const modifiedTokens = [];
	const secondBarAccidentals = new Map();

	for (const token of secondBarTokens) {
		// Non-note tokens pass through unchanged
		if (
			token.isSilence ||
			token.isDummy ||
			token.isInlineField ||
			token.isChordSymbol ||
			token.isTuple ||
			token.isBrokenRhythm ||
			token.isVariantEnding ||
			token.isDecoration ||
			token.isGraceNote
		) {
			modifiedTokens.push(token);
			continue;
		}

		const noteInfos = extractNoteInfo(token);

		// If no notes extracted, pass through
		if (noteInfos.length === 0) {
			modifiedTokens.push(token);
			continue;
		}

		// Check if we need to modify this token
		let needsModification = false;
		const modificationsNeeded = [];

		for (const {
			noteLetter,
			octaveMarkers,
			accidental,
			noteWithOctave
		} of noteInfos) {
			const baseNoteLetter = noteLetter.toUpperCase();
			const firstBarAccidental = firstBarAccidentals.get(noteWithOctave);
			const keyAccidental = keyAccidentals.get(baseNoteLetter) || null;

			if (accidental) {
				// Has explicit accidental
				const currentAccidental = secondBarAccidentals.get(noteWithOctave);

				if (currentAccidental !== undefined) {
					// Already set in this bar (merged context)
					secondBarAccidentals.set(noteWithOctave, accidental);
					modificationsNeeded.push(null);
				} else if (accidental === firstBarAccidental) {
					// Redundant - same as what's in effect from first bar
					needsModification = true;
					secondBarAccidentals.set(noteWithOctave, accidental);
					modificationsNeeded.push("remove");
				} else {
					// Different accidental, keep it
					secondBarAccidentals.set(noteWithOctave, accidental);
					modificationsNeeded.push(null);
				}
			} else {
				// No explicit accidental
				const currentAccidental = secondBarAccidentals.get(noteWithOctave);

				if (currentAccidental !== undefined) {
					// Already set in this bar, no modification
					modificationsNeeded.push(null);
				} else if (
					firstBarAccidental !== undefined &&
					firstBarAccidental !== keyAccidental
				) {
					// Bar 1 had this note with a different accidental than key signature
					// Need to add the key signature accidental to restore it
					needsModification = true;
					const neededAccidental = keyAccidental || "=";
					secondBarAccidentals.set(noteWithOctave, neededAccidental);
					modificationsNeeded.push(neededAccidental);
				} else {
					// No modification needed (bar 1 didn't have this note, or had same as key)
					secondBarAccidentals.set(noteWithOctave, keyAccidental);
					modificationsNeeded.push(null);
				}
			}
		}

		if (needsModification) {
			// Reconstruct the token with added accidentals
			const modifiedToken = { ...token };
			let modifiedTokenStr = token.token;

			// For simple single notes (not chords), we can modify directly
			if (!token.isChord && modificationsNeeded[0]) {
				// Find where the note letter starts (after decorations)
				const noteMatch = modifiedTokenStr.match(
					/(^[~.MPSTHUV!]*(?:![^!]+!)*\s*)?(__|_|=|\^\^|\^)?([A-Ga-g])/
				);
				if (noteMatch) {
					const prefix = noteMatch[1] || "";
					const existingAcc = noteMatch[2] || "";
					const noteLetter = noteMatch[3];
					const afterNote = modifiedTokenStr.substring(
						prefix.length + existingAcc.length + noteLetter.length
					);

					if (modificationsNeeded[0] === "remove") {
						// Remove the existing accidental
						modifiedTokenStr = prefix + noteLetter + afterNote;
					} else {
						// Add or change the accidental
						modifiedTokenStr =
							prefix + modificationsNeeded[0] + noteLetter + afterNote;
					}
				}
			}
			// For chords, this is more complex - we'd need to modify the chord parsing
			// For now, mark that it needs modification and handle in integration

			modifiedToken.token = modifiedTokenStr;
			modifiedToken.needsAccidentalModification = needsModification;
			modifiedToken.accidentalModifications = modificationsNeeded;
			modifiedTokens.push(modifiedToken);
		} else {
			modifiedTokens.push(token);
		}
	}

	return modifiedTokens;
}

/**
 * Remove redundant accidentals when splitting a bar
 *
 * @param {Array<object>} secondHalfTokens - Tokens from second half after split
 * @param {Map<string, string>} firstHalfAccidentals - Accidentals from first half
 * @param {Map<string, string>} keyAccidentals - Accidentals from key signature
 * @returns {Array<object>} - Modified tokens with redundant accidentals removed
 */
function removeRedundantAccidentals(
	secondHalfTokens,
	firstHalfAccidentals,
	keyAccidentals
) {
	const modifiedTokens = [];
	const secondHalfAccidentals = new Map();

	for (const token of secondHalfTokens) {
		// Non-note tokens pass through
		if (
			token.isSilence ||
			token.isDummy ||
			token.isInlineField ||
			token.isChordSymbol ||
			token.isTuple ||
			token.isBrokenRhythm ||
			token.isVariantEnding ||
			token.isDecoration ||
			token.isGraceNote
		) {
			modifiedTokens.push(token);
			continue;
		}

		const noteInfos = extractNoteInfo(token);

		if (noteInfos.length === 0) {
			modifiedTokens.push(token);
			continue;
		}

		// Check if we need to remove accidentals
		let needsModification = false;
		const modificationsNeeded = [];

		for (const {
			noteLetter,
			octaveMarkers,
			accidental,
			noteWithOctave
		} of noteInfos) {
			const baseNoteLetter = noteLetter.toUpperCase();
			const keyAccidental = keyAccidentals.get(baseNoteLetter) || null;
			const currentAccidental = secondHalfAccidentals.get(noteWithOctave);

			// Normalize accidentals for comparison: treat '=' and null as equivalent (both natural)
			const normalizedAccidental = accidental === "=" ? null : accidental;
			const normalizedKeyAccidental =
				keyAccidental === "=" ? null : keyAccidental;

			if (currentAccidental !== undefined) {
				// Already set in second half
				modificationsNeeded.push(null);
			} else if (
				normalizedAccidental === normalizedKeyAccidental &&
				accidental !== null
			) {
				// Redundant - explicit accidental matches key signature
				// (only remove explicit accidentals, not implicit ones)
				needsModification = true;
				secondHalfAccidentals.set(noteWithOctave, accidental);
				modificationsNeeded.push("remove");
			} else {
				// Keep it
				if (accidental) {
					secondHalfAccidentals.set(noteWithOctave, accidental);
				} else {
					secondHalfAccidentals.set(noteWithOctave, keyAccidental);
				}
				modificationsNeeded.push(null);
			}
		}

		if (needsModification) {
			const modifiedToken = { ...token };
			let modifiedTokenStr = token.token;

			// For simple single notes
			if (!token.isChord && modificationsNeeded[0] === "remove") {
				// Remove the accidental
				const noteMatch = modifiedTokenStr.match(
					/(^[~.MPSTHUV!]*(?:![^!]+!)*\s*)?(__|_|=|\^\^|\^)?([A-Ga-g])/
				);
				if (noteMatch && noteMatch[2]) {
					const prefix = noteMatch[1] || "";
					const accToRemove = noteMatch[2];
					const noteLetter = noteMatch[3];
					const afterNote = modifiedTokenStr.substring(
						prefix.length + accToRemove.length + noteLetter.length
					);

					modifiedTokenStr = prefix + noteLetter + afterNote;
				}
			}

			modifiedToken.token = modifiedTokenStr;
			modifiedToken.needsAccidentalModification = needsModification;
			modifiedToken.accidentalModifications = modificationsNeeded;
			modifiedTokens.push(modifiedToken);
		} else {
			modifiedTokens.push(token);
		}
	}

	return modifiedTokens;
}

/**
 * Reconstruct music text from tokens
 * @param {Array<object>} tokens - Array of token objects
 * @param {string} originalMusicText - Original music text for spacing reference
 * @returns {string} - Reconstructed music text
 */
function reconstructMusicFromTokens(tokens, originalMusicText) {
	if (tokens.length === 0) return "";

	let result = "";

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];

		// Add the token (possibly modified)
		result += token.token;

		// Add spacing after token (but not after the last token)
		if (i < tokens.length - 1 && token.spacing && token.spacing.whitespace) {
			result += token.spacing.whitespace;
		}
	}

	return result;
}

module.exports = {
	getKeySignatureAccidentals,
	getBarAccidentals,
	extractNoteInfo,
	addAccidentalsForMergedBar,
	removeRedundantAccidentals,
	reconstructMusicFromTokens
};
