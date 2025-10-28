const { Fraction } = require("./math.js");
const {
	parseABCWithBars,
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
		min: "minor",
		minor: "minor",
		aeo: "minor",
		aeolian: "minor",
		mix: "mixolydian",
		mixo: "mixolydian",
		mixolydian: "mixolydian",
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
 * @param {object} parsed - Parsed ABC data from parseABCWithBars
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
	const parsed = parseABCWithBars(abc, { maxBars: 2 });
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
 * This is nearly a true inverse operation - going there and back preserves the ABC except for some
 * edge cases involving spaces around the bar lines. No need to handle them.
 * Handles anacrusis correctly and preserves line breaks
 *
 * @param {string} abc - ABC notation
 * @param {Array<number>} smallMeter - The smaller meter signature [num, den]
 * @param {Array<number>} largeMeter - The larger meter signature [num, den]
 * @returns {string} - ABC with toggled meter
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

	const parsed = parseABCWithBars(abc);
	const { headerLines, barLines, musicText } = parsed;

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
		// Going from small to large: remove every other bar line (except final)
		const barLinesToRemove = new Set();
		const startIndex = hasPickup ? 1 : 0;

		for (let i = startIndex; i < barLines.length - 1; i += 2) {
			barLinesToRemove.add(barLines[i].sourceIndex);
		}

		// Reconstruct music by removing marked bar lines
		let newMusic = "";
		let lastPos = 0;

		for (let i = 0; i < barLines.length; i++) {
			const barLine = barLines[i];
			newMusic += musicText.substring(lastPos, barLine.sourceIndex);

			if (!barLinesToRemove.has(barLine.sourceIndex)) {
				lastPos = barLine.sourceIndex;
			} else {
				// Remove the bar line - skip over it
				lastPos = barLine.sourceIndex + barLine.sourceLength;
			}
		}
		newMusic += musicText.substring(lastPos);

		return `${newHeaders.join("\n")}\n${newMusic}`;
	} else {
		// Going from large to small: add bar line in middle of each bar
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
	const parsed = parseABCWithBars(abc, { maxBars: estimatedMaxBars });
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
