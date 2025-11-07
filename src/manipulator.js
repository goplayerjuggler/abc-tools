const { Fraction } = require("./math.js");
const {
	parseAbc,
	getMeter,
	calculateBarDurations,
} = require("./parse/parser.js");

const { getBarInfo } = require("./parse/getBarInfo.js");

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
 * Correctly handles anacrusis (pickup bars), multi-bar variant endings, partial bars, and preserves line breaks.
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

	const parsed = parseAbc(abc);
	const { headerLines, barLines, musicText, bars, meter } = parsed;

	// Change meter in headers
	const newHeaders = headerLines.map((line) => {
		if (line.match(/^M:/)) {
			return isSmall
				? `M:${largeMeter[0]}/${largeMeter[1]}`
				: `M:${smallMeter[0]}/${smallMeter[1]}`;
		}
		return line;
	});

	if (isSmall) {
		// Going from small to large: remove every other bar line
		// Get bar info with barNumbers to understand the musical structure
		getBarInfo(bars, barLines, meter, {
			barNumbers: true,
			isPartial: true,
		});

		// Build a map of which bars start with variant endings
		const barStartsWithVariant = new Map();
		for (let i = 0; i < bars.length; i++) {
			if (bars[i].length > 0 && bars[i][0].isVariantEnding) {
				barStartsWithVariant.set(i, bars[i][0]);
			}
		}

		// Determine which bar lines to keep or remove
		const barLineDecisions = new Map(); // barLineIndex -> {action, variantToken?}
		let barPosition = 0; // Position within current pairing (0 or 1)
		let barNumberOfStartOfSection = 0;

		for (let i = 0; i < barLines.length; i++) {
			const barLine = barLines[i];

			// Initial bar line is always kept
			if (barLine.barNumber === null) {
				barLineDecisions.set(i, { action: "keep" });
				continue;
			}

			// initial anacrucis bar line of section is always kept
			if (
				barLine.barNumber === barNumberOfStartOfSection &&
				barLine.isPartial
			) {
				barLineDecisions.set(i, { action: "keep" });
				continue;
			}

			// Final bar line is always kept
			if (i === barLines.length - 1) {
				barLineDecisions.set(i, { action: "keep" });
				continue;
			}

			// Section breaks are always kept and reset pairing
			if (barLine.isSectionBreak) {
				barLineDecisions.set(i, { action: "keep" });
				barPosition = 0;
				barNumberOfStartOfSection = barLine.barNumber;
				continue;
			}

			// barLines[i] comes after bars[i], so the NEXT bar is bars[i+1]
			const nextBarIdx = i + 1;
			const nextBarVariant =
				nextBarIdx < bars.length ? barStartsWithVariant.get(nextBarIdx) : null;

			// If the current bar (bars[i]) starts with a variant, keep its bar line and reset position
			const currentBarVariant = barStartsWithVariant.get(i);
			if (currentBarVariant) {
				barLineDecisions.set(i, { action: "keep" });
				barPosition = 0;
				continue;
			}

			// Normal pairing logic
			if (barPosition === 0) {
				// First of pair - remove
				if (nextBarVariant) {
					barLineDecisions.set(i, {
						action: "remove",
						variantToken: nextBarVariant,
					});
				} else {
					barLineDecisions.set(i, { action: "remove" });
				}
				barPosition = 1;
			} else {
				// Second of pair - keep
				barLineDecisions.set(i, { action: "keep" });
				barPosition = 0;
			}
		}

		// Track variant replacements
		const variantReplacements = new Map();
		for (const [, decision] of barLineDecisions) {
			if (decision.action === "remove" && decision.variantToken) {
				const token = decision.variantToken;
				const newToken = token.token.replace(/^\|/, "[");
				variantReplacements.set(token.sourceIndex, {
					oldLength: token.sourceLength,
					newText: " " + newToken,
				});
			}
		}

		// Reconstruct music
		let newMusic = "";
		let pos = 0;

		while (pos < musicText.length) {
			// Check for variant replacement
			if (variantReplacements.has(pos)) {
				const replacement = variantReplacements.get(pos);
				newMusic += replacement.newText;
				pos += replacement.oldLength;
				continue;
			}

			// Check for bar line
			const barLineIdx = barLines.findIndex((bl) => bl.sourceIndex === pos);
			if (barLineIdx >= 0) {
				const decision = barLineDecisions.get(barLineIdx);
				const barLine = barLines[barLineIdx];

				if (
					decision &&
					decision.action === "remove" &&
					!decision.variantToken
				) {
					// Remove bar line and ensure there's a space
					// Check if we already added a space (last char in newMusic)
					const needsSpace =
						newMusic.length === 0 || newMusic[newMusic.length - 1] !== " ";
					if (needsSpace) {
						newMusic += " ";
					}
					let skipLength = barLine.sourceLength;
					// Skip any trailing space after the bar line to avoid double spaces
					if (
						pos + skipLength < musicText.length &&
						musicText[pos + skipLength] === " "
					) {
						skipLength++;
					}
					pos += skipLength;
					continue;
				} else if (decision && decision.action === "keep") {
					// Keep this bar line
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
		// Going from large to small: add bar lines at midpoints
		const barInfo = getBarInfo(bars, barLines, meter, {
			divideBarsBy: 2,
		});

		const { midpoints } = barInfo;

		// Insert bar lines at calculated positions
		const insertionPoints = [...midpoints].sort((a, b) => b - a);
		let newMusic = musicText;

		for (const pos of insertionPoints) {
			newMusic = newMusic.substring(0, pos) + "| " + newMusic.substring(pos);
		}

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
		typeof numBars === "number" ? new Fraction(numBars) : numBars;

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

	//todo
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

	// if (endPos === startPos) {
	// 	throw new Error(
	// 		`Not enough bars to satisfy request. Requested ${numBars} bars.`
	// 	);
	// }

	if (endPos === startPos) {
		endPos = musicText.length - 1;
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
