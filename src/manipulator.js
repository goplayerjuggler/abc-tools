const { Fraction } = require("./math.js");
const {
	parseAbc,
	getMeter,
	calculateBarDurations,
} = require("./parse/parser.js");

// ============================================================================
// ABC manipulation functions
// ============================================================================

/**
 * Normalises an ABC key header into a structured array of tonic, mode, and accidentals.
 * Supports both ASCII and Unicode accidentals, and handles multiple modifying accidentals.
 *
 * @param {string} keyHeader - The contents of the K: header (e.g., "D#m", "Fb maj", "D min ^g ^c").
 * @returns {[string, string, string?]} An array containing:
 *   - The normalised tonic (e.g., "D♯", "F♭").
 *   - The normalised mode (e.g., "minor", "major", "mixolydian").
 *   - Optional: A string of accidentals (e.g., "^g ^c", "=c __f").
 *
 * @example
 * normaliseKey('D#m');            // ["D♯", "minor"]
 * normaliseKey('Fb maj');         // ["F♭", "major"]
 * normaliseKey('G# mixolydian');  // ["G♯", "mixolydian"]
 * normaliseKey('Cion');           // ["C", "major"]
 * normaliseKey('D min ^g ^c');    // ["D", "minor", "^g ^c"]
 * normaliseKey('D maj =c __f');   // ["D", "major", "=c __f"]
 */
function normaliseKey(keyHeader) {
	const key = keyHeader.toLowerCase().trim();
	// Extract note and accidental, normalising ASCII to Unicode
	const noteMatch = key.match(/^([a-g])(#|b|x|bb|×|♭|♯)?/);
	const noteBase = noteMatch ? noteMatch[1].toUpperCase() : "C";
	const accidental =
		noteMatch && noteMatch[2]
			? noteMatch[2].replace("#", "♯").replace("b", "♭")
			: "";
	const note = noteBase + accidental;

	const modeMap = {
		maj: "major",
		major: "major",
		ion: "major",
		ionian: "major",
		mix: "mixolydian",
		mixo: "mixolydian",
		mixolydian: "mixolydian",
		m: "minor",
		min: "minor",
		minor: "minor",
		aeo: "minor",
		aeolian: "minor",
		dor: "dorian",
		dorian: "dorian",
		phr: "phrygian",
		phrygian: "phrygian",
		lyd: "lydian",
		lydian: "lydian",
		loc: "locrian",
		locrian: "locrian",
	};
	const mode = Object.keys(modeMap).find((m) => key.includes(m)) || "major";

	// Extract all accidentals (e.g., "^g ^c", "__f", "=c")
	const accidentalsMatch = key.match(/(?:^|\s)(?:__|_|=|\^|\^\^)[a-g]/g);
	const accidentals = accidentalsMatch
		? accidentalsMatch.join("").trim()
		: null;

	const result = [note, modeMap[mode]];
	if (accidentals) {
		result.push(accidentals);
	}
	return result;
}

/**
 * Filter headers based on configuration
 * @param {Array<string>} headerLines - Array of header line strings
 * @param {object} headersToStrip - Configuration {all:boolean, toKeep:string}
 * @returns {Array<string>} - Filtered header lines
 */
function filterHeaders(headerLines, headersToStrip) {
	if (!headersToStrip || !headersToStrip.all) {
		return headerLines;
	}

	// Keep only X, M, L, K headers when stripping
	return headerLines.filter((line) => "XMLK".indexOf(line[0]) >= 0);
}

/**
 * Detect if ABC notation has an anacrusis (pickup bar)
 * @param {object} parsed - Parsed ABC data from parseAbc
 * @returns {boolean} - True if anacrusis is present
 */
function hasAnacrucisFromParsed(parsed) {
	const barDurations = calculateBarDurations(parsed);
	const expectedBarDuration = new Fraction(parsed.meter[0], parsed.meter[1]);

	if (parsed.bars.length === 0) {
		return false;
	}

	const firstBarDuration = barDurations[0];
	return firstBarDuration.compare(expectedBarDuration) < 0;
}

/**
 * Detect if ABC notation has an anacrusis (pickup bar)
 * @param {string} abc - ABC notation
 * @returns {boolean} - True if anacrusis is present
 */
function hasAnacrucis(abc) {
	const parsed = parseAbc(abc, { maxBars: 2 });
	return hasAnacrucisFromParsed(parsed);
}
/**
 * Inserts a specified character at multiple positions within a string.
 * Optimised for performance with long strings and repeated usage.
 *
 * @param {string} originalString - The original string to modify.
 * @param {string} charToInsert - The character to insert at the specified positions.
 * @param {number[]} indexes - An array of positions (zero-based) where the character should be inserted.
 * @returns {string} The modified string with characters inserted at the specified positions.
 *
 * // Example usage:
 * const originalString = "hello world";
 * const charToInsert = "!";
 * const indexes = [2, 5, 8, 2, 15];
 * const result = insertCharsAtIndexes(originalString, charToInsert, indexes);
 * console.log(result); // Output: "he!l!lo! world!"
 *
 */
function insertCharsAtIndexes(originalString, charToInsert, indexes) {
	// Filter and sort indexes only once: remove duplicates and invalid positions
	const validIndexes = [...new Set(indexes)]
		.filter((index) => index >= 0 && index <= originalString.length)
		.sort((a, b) => a - b);

	const result = [];
	let prevIndex = 0;

	for (const index of validIndexes) {
		// Push the substring up to the current index
		result.push(originalString.slice(prevIndex, index));
		// Push the character to insert
		result.push(charToInsert);
		// Update the previous index
		prevIndex = index;
	}

	// Push the remaining part of the string
	result.push(originalString.slice(prevIndex));

	return result.join("");
}

/**
 * Toggle meter by doubling or halving bar length
 * Supports 4/4↔4/2 and 6/8↔12/8 transformations
 *
 * When going from small to large meters (e.g., 4/4→4/2):
 * - Removes alternate bar lines to combine pairs of bars
 * - Converts variant ending markers from |1, |2 to [1, [2 format
 * - Respects section breaks (||, :|, etc.) and resets pairing after them
 * - Handles bars starting with variant endings by keeping the bar line after them
 *
 * When going from large to small meters (e.g., 4/2→4/4):
 * - Inserts bar lines at halfway points within each bar
 * - Preserves variant ending markers in [1, [2 format (does not convert back to |1, |2)
 * - Inserts bar lines before variant endings when they occur at the split point
 *
 * This is nearly a true inverse operation - going there and back preserves musical content
 * but may change spacing around bar lines and normalises variant ending syntax to [1, [2 format.
 * Correctly handles anacrusis (pickup bars), multi-bar variant endings, and preserves line breaks.
 *
 * @param {string} abc - ABC notation string
 * @param {Array<number>} smallMeter - The smaller meter signature [numerator, denominator]
 * @param {Array<number>} largeMeter - The larger meter signature [numerator, denominator]
 * @returns {string} ABC notation with toggled meter
 * @throws {Error} If the current meter doesn't match either smallMeter or largeMeter
 */
function toggleMeterDoubling(abc, smallMeter, largeMeter) {
	const currentMeter = getMeter(abc);

	const isSmall =
		currentMeter[0] === smallMeter[0] && currentMeter[1] === smallMeter[1];
	const isLarge =
		currentMeter[0] === largeMeter[0] && currentMeter[1] === largeMeter[1];

	if (!isSmall && !isLarge) {
		throw new Error(
			`Meter must be ${smallMeter[0]}/${smallMeter[1]} or ${largeMeter[0]}/${largeMeter[1]}`
		);
	}

	if (isSmall) {
		// We're going to remove some bars, so ensure every bar line (pipe / `|`) has a space preceding it
		// Regex handles bars like :| and [|]
		abc = abc.replaceAll(/([^\s])([[:]?\|)/g, "$1 $2");
	}

	const parsed = parseAbc(abc);
	const { headerLines, barLines, musicText, bars } = parsed;

	// Change meter in headers
	const newHeaders = headerLines.map((line) => {
		if (line.match(/^M:/)) {
			return isSmall
				? `M:${largeMeter[0]}/${largeMeter[1]}`
				: `M:${smallMeter[0]}/${smallMeter[1]}`;
		}
		return line;
	});

	const hasPickup = hasAnacrucisFromParsed(parsed);

	if (isSmall) {
		// Going from small to large: remove every other bar line
		// Key insight: barLines[i] comes AFTER bars[i]
		// When a bar starts with a variant ending like |1, the token includes the bar line

		// Build a map of which bars start with variant endings
		const barStartsWithVariant = new Map();
		for (let i = 0; i < bars.length; i++) {
			if (bars[i].length > 0 && bars[i][0].isVariantEnding) {
				barStartsWithVariant.set(i, bars[i][0]);
			}
		}

		// Build decisions for each bar line
		const barLineDecisions = new Map(); // barLineIndex -> {action, variantToken?}

		let barPosition = 0; // Position within the current grouping (0 or 1)
		const startBarIndex = hasPickup ? 1 : 0;

		for (let i = startBarIndex; i < barLines.length; i++) {
			const barLine = barLines[i];
			const nextBarIdx = i + 1; // Bar that comes AFTER this bar line
			const currentBarIdx = i; // Bar that comes BEFORE this bar line

			// Check if this bar line ends a section
			const isSectionEnd = barLine.isSectionBreak;

			// Check if the next bar starts with a variant ending
			const nextBarVariant = barStartsWithVariant.get(nextBarIdx);

			// Check if current bar starts with a variant ending
			const currentBarVariant = barStartsWithVariant.get(currentBarIdx);

			if (i === barLines.length - 1) {
				// Always keep the final bar line
				barLineDecisions.set(i, { action: "keep" });
			} else if (isSectionEnd) {
				// Always keep section-ending bar lines
				barLineDecisions.set(i, { action: "keep" });
				barPosition = 0; // Reset position after section break
			} else if (currentBarVariant) {
				// If current bar started with a variant, reset position and keep this bar line
				barLineDecisions.set(i, { action: "keep" });
				barPosition = 0; // Variant ending starts a new pairing sequence
			} else if (barPosition === 0) {
				// First bar of a pair - remove this bar line
				if (nextBarVariant) {
					// Next bar has variant ending - we'll need to modify it
					barLineDecisions.set(i, {
						action: "remove",
						variantToken: nextBarVariant,
					});
				} else {
					barLineDecisions.set(i, { action: "remove" });
				}
				barPosition = 1;
			} else {
				// Second bar of a pair - keep this bar line
				barLineDecisions.set(i, { action: "keep" });
				barPosition = 0;
			}
		}

		// Also track which variant ending tokens need to be replaced
		const variantReplacements = new Map(); // sourceIndex -> newText
		for (const [barLineIdx, decision] of barLineDecisions) {
			if (decision.action === "remove" && decision.variantToken) {
				const token = decision.variantToken;
				// Replace |1 with [1, |2 with [2, etc.
				const newToken = token.token.replace(/^\|/, "[");
				variantReplacements.set(token.sourceIndex, {
					oldLength: token.sourceLength,
					newText: " " + newToken, // Add space before [1
				});
			}
		}

		// Reconstruct music
		let newMusic = "";
		let pos = 0;

		// Process character by character, applying replacements
		while (pos < musicText.length) {
			// Check if we're at a variant replacement position
			if (variantReplacements.has(pos)) {
				const replacement = variantReplacements.get(pos);
				newMusic += replacement.newText;
				pos += replacement.oldLength;
				continue;
			}

			// Check if we're at a bar line that should be removed
			const barLineIdx = barLines.findIndex((bl) => bl.sourceIndex === pos);
			if (barLineIdx >= 0) {
				const decision = barLineDecisions.get(barLineIdx);
				if (
					decision &&
					decision.action === "remove" &&
					!decision.variantToken
				) {
					// Skip this bar line
					pos += barLines[barLineIdx].sourceLength;
					continue;
				} else if (decision && decision.action === "keep") {
					// Keep this bar line
					const barLine = barLines[barLineIdx];
					newMusic += musicText.substring(pos, pos + barLine.sourceLength);
					pos += barLine.sourceLength;
					continue;
				}
			}

			// Regular character
			newMusic += musicText[pos];
			pos++;
		}

		return `${newHeaders.join("\n")}\n${newMusic}`;
	} else {
		// Going from large to small: add bar line in middle of each bar
		// Keep variant endings as [1, [2 etc. (don't convert back to |1, |2)
		const halfBarDuration = new Fraction(smallMeter[0], smallMeter[1]);
		const insertionPoints = [];
		const startBarIndex = hasPickup ? 1 : 0;

		for (let barIdx = startBarIndex; barIdx < parsed.bars.length; barIdx++) {
			const bar = parsed.bars[barIdx];
			let barDuration = new Fraction(0, 1);
			let insertPos = null;

			// Find position where we've accumulated half a bar
			for (let noteIdx = 0; noteIdx < bar.length; noteIdx++) {
				const token = bar[noteIdx];

				// Skip variant endings - they stay as-is ([1, [2, etc.)
				if (token.isVariantEnding) {
					// If this variant is at the halfway point, insert bar line before it
					if (insertPos === null && barDuration.compare(halfBarDuration) >= 0) {
						insertPos = token.sourceIndex;
						break;
					}
					continue;
				}

				// Skip tokens with no duration
				if (!token.duration) {
					continue;
				}

				const prevDuration = barDuration.clone();
				barDuration = barDuration.add(token.duration);

				// Check if we've just crossed the halfway point
				if (
					prevDuration.compare(halfBarDuration) < 0 &&
					barDuration.compare(halfBarDuration) >= 0
				) {
					// Insert bar line after this note
					insertPos = token.sourceIndex + token.sourceLength;
					// Skip any trailing space that's part of this note
					if (token.spacing && token.spacing.whitespace) {
						insertPos += token.spacing.whitespace.length;
					}
					break;
				}
			}

			if (insertPos !== null) {
				insertionPoints.push(insertPos);
			}
		}

		// Insert bar lines at calculated positions
		const newMusic = insertCharsAtIndexes(musicText, "| ", insertionPoints);

		return `${newHeaders.join("\n")}\n${newMusic}`;
	}
}
/**
 * Toggle between M:4/4 and M:4/2 by surgically adding/removing bar lines
 * This is a true inverse operation - going there and back preserves the ABC exactly
 * Handles anacrusis correctly and preserves line breaks
 */
function toggleMeter_4_4_to_4_2(abc) {
	return toggleMeterDoubling(abc, [4, 4], [4, 2]);
}

/**
 * Toggle between M:6/8 and M:12/8 by surgically adding/removing bar lines
 * This is a true inverse operation - going there and back preserves the ABC exactly
 * Handles anacrusis correctly and preserves line breaks
 */
function toggleMeter_6_8_to_12_8(abc) {
	return toggleMeterDoubling(abc, [6, 8], [12, 8]);
}

/**
 * Get the first N complete or partial bars from ABC notation, with or without the anacrusis
 * Preserves all formatting, comments, spacing, and line breaks
 * @param {string} abc - ABC notation
 * @param {number|Fraction} numBars - Number of bars to extract (can be fractional, e.g., 1.5 or new Fraction(3,2))
 * @param {boolean} withAnacrucis - when flagged, the returned result also includes the anacrusis - incomplete bar (default: false)
 * @param {boolean} countAnacrucisInTotal - when true AND withAnacrucis is true, the anacrusis counts toward numBars duration (default: false)
 * @param {object} headersToStrip - optional header stripping configuration {all:boolean, toKeep:string}
 * @returns {string} - ABC with (optionally) the anacrusis, plus the first `numBars` worth of music
 */
function getFirstBars(
	abc,
	numBars = 1,
	withAnacrucis = false,
	countAnacrucisInTotal = false,
	headersToStrip
) {
	// Convert numBars to Fraction if it's a number
	const numBarsFraction =
		typeof numBars === "number"
			? new Fraction(Math.round(numBars * 1000), 1000)
			: numBars;

	// Estimate maxBars needed - simple ceiling with buffer
	const estimatedMaxBars =
		Math.ceil(numBarsFraction.num / numBarsFraction.den) + 2;

	// Parse with estimated maxBars
	const parsed = parseAbc(abc, { maxBars: estimatedMaxBars });
	const { bars, headerLines, barLines, musicText, meter } = parsed;

	const barDurations = calculateBarDurations(parsed);
	const expectedBarDuration = new Fraction(meter[0], meter[1]);
	const targetDuration = expectedBarDuration.multiply(numBarsFraction);

	// Find first complete bar index
	let firstCompleteBarIdx = -1;
	for (let i = 0; i < bars.length; i++) {
		const barDuration = barDurations[i];
		if (barDuration.compare(expectedBarDuration) === 0) {
			firstCompleteBarIdx = i;
			break;
		}
	}

	if (firstCompleteBarIdx === -1) {
		throw new Error("No complete bars found");
	}

	const hasPickup = firstCompleteBarIdx > 0;

	// Filter headers if requested
	const filteredHeaders = filterHeaders(headerLines, headersToStrip);

	// Determine starting position in the music text
	let startPos = 0;
	if (hasPickup && withAnacrucis) {
		// Include anacrusis in output
		startPos = 0;
	} else if (hasPickup && !withAnacrucis) {
		// Skip anacrusis - start after its bar line
		const anacrusisBarLine = barLines[firstCompleteBarIdx - 1];
		if (anacrusisBarLine) {
			startPos = anacrusisBarLine.sourceIndex + anacrusisBarLine.sourceLength;
		}
	}

	// Calculate accumulated duration for target calculation
	let accumulatedDuration = new Fraction(0, 1);
	if (hasPickup && withAnacrucis && countAnacrucisInTotal) {
		// Count anacrusis toward target
		accumulatedDuration = barDurations[0];
	}

	// Find the end position by accumulating bar durations from first complete bar
	let endPos = startPos;

	for (let i = firstCompleteBarIdx; i < bars.length; i++) {
		const barDuration = barDurations[i];
		const newAccumulated = accumulatedDuration.add(barDuration);

		if (newAccumulated.compare(targetDuration) >= 0) {
			// We've reached or exceeded target

			if (newAccumulated.compare(targetDuration) === 0) {
				// Exact match - include full bar with its bar line
				if (i < barLines.length) {
					endPos = barLines[i].sourceIndex + barLines[i].sourceLength;
				}
			} else {
				// Need partial bar
				const remainingDuration = targetDuration.subtract(accumulatedDuration);
				const bar = bars[i];
				let barAccumulated = new Fraction(0, 1);

				for (const token of bar) {
					// Skip tokens with no duration
					if (!token.duration) {
						continue;
					}

					barAccumulated = barAccumulated.add(token.duration);

					// Check if we've reached or exceeded the remaining duration
					if (barAccumulated.compare(remainingDuration) >= 0) {
						// Include this note
						endPos = token.sourceIndex + token.sourceLength;

						// Skip trailing space if present
						if (
							token.spacing &&
							token.spacing.whitespace &&
							endPos < musicText.length &&
							musicText[endPos] === " "
						) {
							endPos++;
						}
						break;
					}
				}
			}
			break;
		}

		accumulatedDuration = newAccumulated;
	}

	if (endPos === startPos) {
		throw new Error(
			`Not enough bars to satisfy request. Requested ${numBars} bars.`
		);
	}

	// Reconstruct ABC
	return `${filteredHeaders.join("\n")}\n${musicText.substring(
		startPos,
		endPos
	)}`;
}

module.exports = {
	getFirstBars,
	hasAnacrucis,
	toggleMeter_4_4_to_4_2,
	toggleMeter_6_8_to_12_8,
	filterHeaders,
	normaliseKey,
};
