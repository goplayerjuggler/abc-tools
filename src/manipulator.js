const { Fraction } = require("./math.js");
const { parseAbc, getMeter, getUnitLength } = require("./parse/parser.js");

const { getBarInfo } = require("./parse/getBarInfo.js");
const { getHeaderValue } = require("./parse/header-parser.js");

const {
	getKeySignatureAccidentals,
	getBarAccidentals,
	addAccidentalsForMergedBar,
	removeRedundantAccidentals,
	reconstructMusicFromTokens
} = require("./parse/accidental-helpers.js");

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
		locrian: "locrian"
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
 * Detect if ABC notation has an anacrusis (pickup bar) from parsed data or from barLines array
 * @param {object} parsed - Parsed ABC data from parseAbc
 * @param {Array<object>} barLines - enriched barLine array from getBarInfo
 * @returns {boolean} - True if anacrusis is present
 */
function hasAnacrucisFromParsed(parsed, barLines) {
	const callParse = !barLines;
	if (callParse) {
		const { bars, meter } = parsed;
		if (bars.length === 0) return false;
		({ barLines } = parsed);
		// Use getBarInfo to analyse the first bar
		getBarInfo(bars, barLines, meter, {
			barNumbers: true,
			isPartial: true,
			cumulativeDuration: false
		});
	}

	if (barLines.length === 0) {
		return false;
	}

	// Find the first bar line with a barNumber (skip initial bar line if present)
	const firstNumberedBarLine = barLines.find((bl) => bl.barNumber !== null);

	if (!firstNumberedBarLine) {
		return false;
	}

	// Anacrusis is present if the first numbered bar line is partial with barNumber 0
	return (
		firstNumberedBarLine.barNumber === 0 &&
		firstNumberedBarLine.isPartial === true
	);
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
 * - Adds accidentals when merging bars to restore key signature defaults
 *
 * When going from large to small meters (e.g., 4/2→4/4):
 * - Inserts bar lines at halfway points within each bar
 * - Preserves variant ending markers in [1, [2 format (does not convert back to |1, |2)
 * - Inserts bar lines before variant endings when they occur at the split point
 * - Removes redundant accidentals in the second half of split bars
 *
 * This is nearly a true inverse operation - going there and back preserves musical content
 * but may change spacing around bar lines and normalises variant ending syntax to [1, [2 format.
 * Correctly handles anacrusis (pickup bars), multi-bar variant endings, partial bars, preserves line breaks,
 * and manages accidentals correctly when bars are merged or split.
 *
 * @param {string} abc - ABC notation string
 * @param {Array<number>} smallMeter - The smaller meter signature [numerator, denominator]
 * @param {Array<number>} largeMeter - The larger meter signature [numerator, denominator]
 * @param {Array<number>} currentMeter - The current meter signature [numerator, denominator] of the abc tune - may be omitted. (If omitted, it gets fetched from `abc`)
 * @returns {string} ABC notation with toggled meter
 * @throws {Error} If the current meter doesn't match either smallMeter or largeMeter
 */
function toggleMeterDoubling(abc, smallMeter, largeMeter, currentMeter) {
	if (!currentMeter) currentMeter = getMeter(abc);

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

	// throw if there's a change of meter or unit length in the tune
	if (barLines.find((bl) => bl.newMeter || bl.newUnitLength)) {
		throw new Error("change of meter or unit length not handled");
	}

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
		// Going from small to large: remove every other complete musical bar line

		// Get initial key and build key map
		const initialKey = getHeaderValue(abc, "K");
		const keyAtBar = getKeyAtEachBar(barLines, initialKey);

		// Get bar info to understand musical structure
		getBarInfo(bars, barLines, meter, {
			barNumbers: true,
			isPartial: true
		});

		// Build a map of which bars start with variant endings
		const barStartsWithVariant = new Map();
		for (let i = 0; i < bars.length; i++) {
			if (bars[i].length > 0 && bars[i][0].isVariantEnding) {
				barStartsWithVariant.set(i, bars[i][0]);
			}
		}

		// Determine which bar lines to keep or remove
		const barLineDecisions = new Map();
		const barLinesToConvert = new Map(); // variant markers to convert from |N to [N

		const hasAnacrucis = hasAnacrucisFromParsed(null, barLines);

		for (let i = 0; i < barLines.length; i++) {
			const barLine = barLines[i];

			// Initial bar line (no barNumber) is always kept
			if (barLine.barNumber === null) {
				barLineDecisions.set(i, { action: "keep" });
				continue;
			}

			// Final bar line is always kept
			if (i === barLines.length - 1) {
				barLineDecisions.set(i, { action: "keep" });
				continue;
			}

			// Section breaks are always kept
			if (barLine.isSectionBreak) {
				barLineDecisions.set(i, { action: "keep" });
				continue;
			}

			// Check if this bar line represents a complete musical bar
			const isCompleteMusicBar =
				!barLine.isPartial || barLine.completesMusicBar === true;

			// If not a complete bar, keep it (it's a partial that doesn't complete)
			if (!isCompleteMusicBar) {
				barLineDecisions.set(i, { action: "keep" });
				continue;
			}

			// This is a complete bar - use its barNumber to decide
			// Without anacrucis: Remove complete bars with even barNumber (0, 2, 4, ...), keep odd ones (1, 3, 5, ...)
			// With anacrucis: the other way round!
			const remove = hasAnacrucis
				? barLine.barNumber % 2 !== 0
				: barLine.barNumber % 2 === 0;
			if (remove) {
				// Check if current bar starts with variant
				if (barStartsWithVariant.has(i)) {
					const variantToken = barStartsWithVariant.get(i);
					barLinesToConvert.set(variantToken.sourceIndex, {
						oldLength: variantToken.sourceLength,
						oldText: variantToken.token
					});
				}
				// Also check if next bar starts with variant
				const nextBarIdx = i + 1;
				if (nextBarIdx < bars.length && barStartsWithVariant.has(nextBarIdx)) {
					const variantToken = barStartsWithVariant.get(nextBarIdx);
					barLinesToConvert.set(variantToken.sourceIndex, {
						oldLength: variantToken.sourceLength,
						oldText: variantToken.token
					});
				}
				barLineDecisions.set(i, { action: "remove" });
			} else {
				// This is 1st, 3rd, 5th... complete bar - keep it
				barLineDecisions.set(i, { action: "keep" });
			}
		}

		// === ACCIDENTAL HANDLING ===
		// Build map of bars to replace: bar start position -> {originalEnd, replacementText}

		const barReplacements = new Map();

		for (let i = 0; i < barLines.length; i++) {
			const decision = barLineDecisions.get(i);

			if (decision && decision.action === "remove") {
				// Find which bar comes after this bar line
				const barLineEnd = barLines[i].sourceIndex + barLines[i].sourceLength;

				let bar2Idx = -1;
				for (let b = 0; b < bars.length; b++) {
					if (bars[b].length > 0 && bars[b][0].sourceIndex >= barLineEnd) {
						bar2Idx = b;
						break;
					}
				}

				// Find the bar that ends at or before this bar line
				let bar1Idx = -1;
				for (let b = bars.length - 1; b >= 0; b--) {
					if (bars[b].length > 0) {
						const barEnd =
							bars[b][bars[b].length - 1].sourceIndex +
							bars[b][bars[b].length - 1].sourceLength;
						if (barEnd <= barLines[i].sourceIndex) {
							bar1Idx = b;
							break;
						}
					}
				}

				if (bar1Idx >= 0 && bar2Idx >= 0 && bar2Idx < bars.length) {
					// Get current key
					const currentKey = keyAtBar.get(bar1Idx) || initialKey;
					const keyAccidentals = getKeySignatureAccidentals(
						currentKey,
						normaliseKey
					);

					// Get accidentals at end of bar 1
					const firstBarAccidentals = getBarAccidentals(
						bars[bar1Idx],
						keyAccidentals
					);

					// Modify bar 2 tokens
					const modifiedBar2Tokens = addAccidentalsForMergedBar(
						bars[bar2Idx],
						firstBarAccidentals,
						keyAccidentals,
						musicText
					);

					// Reconstruct bar 2 text
					const bar2Start = bars[bar2Idx][0].sourceIndex;
					const bar2End =
						bars[bar2Idx][bars[bar2Idx].length - 1].sourceIndex +
						bars[bar2Idx][bars[bar2Idx].length - 1].sourceLength;

					const modifiedText = reconstructMusicFromTokens(
						modifiedBar2Tokens,
						musicText
					);
					// console.log(
					// 	`Replacement text: "${modifiedText}" (length: ${modifiedText.length})`
					// );
					// console.log(`First char code: ${modifiedText.charCodeAt(0)}`);

					// Store replacement: when we reach bar2Start, replace until bar2End with modifiedText
					barReplacements.set(bar2Start, {
						originalEnd: bar2End,
						replacementText: modifiedText
					});
				}
			}
		}

		// === END ACCIDENTAL HANDLING ===

		// Reconstruct music
		let newMusic = "";
		let pos = 0;

		while (pos < musicText.length) {
			// Check for variant marker conversion
			if (barLinesToConvert.has(pos)) {
				const conversion = barLinesToConvert.get(pos);
				const newText = conversion.oldText.replace(/^\|/, "[");
				newMusic += newText;
				pos += conversion.oldLength;
				continue;
			}

			// Check for bar line
			const barLineIdx = barLines.findIndex((bl) => bl.sourceIndex === pos);
			if (barLineIdx >= 0) {
				const decision = barLineDecisions.get(barLineIdx);
				const barLine = barLines[barLineIdx];

				if (decision && decision.action === "remove") {
					// Remove bar line and ensure there's a space
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

					// NOW check if the bar after this removed bar line needs replacement
					if (barReplacements.has(pos)) {
						// const replacement = barReplacements.get(pos);
						// newMusic += replacement.replacementText;
						// pos = replacement.originalEnd;

						const replacement = barReplacements.get(pos);
						// console.log(`REPLACING: adding "${replacement.replacementText}"`);
						// console.log(
						// 	`REPLACING: jumping from ${pos} to ${replacement.originalEnd}`
						// );
						newMusic += replacement.replacementText;
						pos = replacement.originalEnd;
						// console.log(`newMusic so far: "${newMusic}"`);
					}

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

		// Get initial key and build key map
		const initialKey = getHeaderValue(abc, "K");
		const keyAtBar = getKeyAtEachBar(barLines, initialKey);

		const barInfo = getBarInfo(bars, barLines, meter, {
			divideBarsBy: 2
		});

		const { midpoints } = barInfo;

		// === ACCIDENTAL HANDLING ===
		// Build map of bar sections to replace

		const barReplacements = new Map();

		for (let i = 0; i < bars.length; i++) {
			const bar = bars[i];
			if (bar.length === 0) continue;

			const barStart = bar[0].sourceIndex;
			const barEnd =
				bar[bar.length - 1].sourceIndex + bar[bar.length - 1].sourceLength;
			const midpoint = midpoints.find((mp) => mp > barStart && mp < barEnd);

			if (midpoint) {
				// Get current key
				const currentKey = keyAtBar.get(i) || initialKey;
				const keyAccidentals = getKeySignatureAccidentals(
					currentKey,
					normaliseKey
				);

				// Split into first and second half
				const firstHalfTokens = bar.filter((t) => t.sourceIndex < midpoint);
				const secondHalfTokens = bar.filter((t) => t.sourceIndex >= midpoint);

				if (secondHalfTokens.length > 0) {
					// Get accidentals from first half
					const firstHalfAccidentals = getBarAccidentals(
						firstHalfTokens,
						keyAccidentals
					);

					// Remove redundant accidentals from second half
					const modifiedSecondHalf = removeRedundantAccidentals(
						secondHalfTokens,
						firstHalfAccidentals,
						keyAccidentals
					);

					// Reconstruct
					const secondHalfStart = secondHalfTokens[0].sourceIndex;
					const secondHalfEnd =
						secondHalfTokens[secondHalfTokens.length - 1].sourceIndex +
						secondHalfTokens[secondHalfTokens.length - 1].sourceLength;

					const modifiedText = reconstructMusicFromTokens(
						modifiedSecondHalf,
						musicText
					);

					// console.log(
					// 	`Replacement text: "${modifiedText}" (length: ${modifiedText.length})`
					// );
					// console.log(`First char code: ${modifiedText.charCodeAt(0)}`);

					barReplacements.set(secondHalfStart, {
						originalEnd: secondHalfEnd,
						replacementText: modifiedText
					});
				}
			}
		}

		// Reconstruct music with replacements
		let newMusic = "";
		let pos = 0;

		while (pos < musicText.length) {
			// Check if we're at a bar section that needs replacement
			if (barReplacements.has(pos)) {
				// const replacement = barReplacements.get(pos);
				// newMusic += replacement.replacementText;
				// pos = replacement.originalEnd;
				// continue;

				const replacement = barReplacements.get(pos);
				// console.log(`REPLACING: adding "${replacement.replacementText}"`);
				// console.log(
				// 	`REPLACING: jumping from ${pos} to ${replacement.originalEnd}`
				// );
				newMusic += replacement.replacementText;
				pos = replacement.originalEnd;
				// console.log(`newMusic so far: "${newMusic}"`);
			}

			// Regular character
			newMusic += musicText[pos];
			pos++;
		}

		// === END ACCIDENTAL HANDLING ===

		// Insert bar lines at calculated positions
		const insertionPoints = [...midpoints].sort((a, b) => b - a);

		// Adjust positions based on replacements
		const adjustedInsertionPoints = [];

		for (const pos of insertionPoints) {
			let adjustedPos = pos;

			// Calculate offset from replacements before this position
			for (const [replStart, replInfo] of barReplacements.entries()) {
				if (replStart < pos) {
					const originalLength = replInfo.originalEnd - replStart;
					const newLength = replInfo.replacementText.length;
					adjustedPos += newLength - originalLength;
				}
			}

			adjustedInsertionPoints.push(adjustedPos);
		}

		// Insert bar lines (in reverse order to maintain positions)
		adjustedInsertionPoints.sort((a, b) => b - a);
		for (const pos of adjustedInsertionPoints) {
			newMusic = newMusic.substring(0, pos) + "| " + newMusic.substring(pos);
		}

		return `${newHeaders.join("\n")}\n${newMusic}`;
	}
}

/**
 * Build a map of bar index to active key signature
 * Tracks key changes from barLines[].newKey
 *
 * @param {Array} barLines - Bar line array from parseAbc
 * @param {string} initialKey - Initial K: header value
 * @returns {Map<number, string>} - Map from bar index to key signature string
 */
function getKeyAtEachBar(barLines, initialKey) {
	const keyMap = new Map();
	let currentKey = initialKey;

	// Bar index 0 is before the first bar line (or at it if there's an initial bar line)
	keyMap.set(0, currentKey);

	for (let i = 0; i < barLines.length; i++) {
		if (barLines[i].newKey) {
			currentKey = barLines[i].newKey;
		}
		// The key after this bar line applies to the next bar
		keyMap.set(i + 1, currentKey);
	}

	return keyMap;
}

/**
 * Toggle between M:4/4 and M:4/2 by surgically adding/removing bar lines
 * This is a true inverse operation - going there and back preserves the ABC exactly
 * Handles anacrusis correctly and preserves line breaks
 */
function toggleMeter_4_4_to_4_2(abc, currentMeter) {
	return toggleMeterDoubling(abc, [4, 4], [4, 2], currentMeter);
}

const defaultCommentForReelConversion =
	"*abc-tools: convert to M:4/4 & L:1/16*";
const defaultCommentForHornpipeConversion = "*abc-tools: convert to M:4/2*";
const defaultCommentForPolkaConversion = "*abc-tools: convert to M:4/4*";
const defaultCommentForJigConversion = "*abc-tools: convert to M:12/8*";
/**
 * Adjusts bar lengths and L, M fields - a 
 * reel written in the normal way (M:4/4 L:1/8) is written
 * written with M:4/4 and L:1/16 (or M:4/2 and L:1/8, if withSemiquavers is unflagged)
 * Bars are twice as long, and the quick notes are semiquavers
 * rather than quavers.
 * @param {string} reel
 * @param {string} comment - when non falsey, the comment will be injected as an N: header
 * @param {bool} withSemiquavers - when unflagged, the L stays at 1/8, and the M is 4/2

 * @returns
 */
function convertStandardReel(
	reel,
	comment = defaultCommentForReelConversion,
	withSemiquavers = true
) {
	const meter = getMeter(reel);
	if (!Array.isArray(meter) || !meter || !meter[0] === 4 || !meter[1] === 4) {
		throw new Error("invalid meter");
	}
	const unitLength = getUnitLength(reel);
	if (unitLength.den !== 8) {
		throw new Error("invalid L header");
	}

	let result = //toggleMeter_4_4_to_4_2(reel, meter);
		toggleMeterDoubling(reel, [4, 4], [4, 2], meter);
	if (comment) {
		result = result.replace(/(\nK:)/, `\nN:${comment}$1`);
	}
	if (withSemiquavers) {
		result = result.replace("M:4/2", "M:4/4").replace("L:1/8", "L:1/16");
	}
	return result;
}

/**
 * Adjusts bar lengths and M field to alter a
 * jig written in the normal way (M:6/8) so it’s
 * written with M:12/8.
 * Bars are twice as long.
 * @param {string} jig
 * @param {string} comment - when non falsey, the comment will be injected as an N: header

 * @returns
 */
function convertStandardJig(jig, comment = defaultCommentForJigConversion) {
	const meter = getMeter(jig);
	if (!Array.isArray(meter) || !meter || !meter[0] === 6 || !meter[1] === 8) {
		throw new Error("invalid meter");
	}

	let result = //toggleMeter_4_4_to_4_2(reel, meter);
		toggleMeterDoubling(jig, [6, 8], [12, 8], meter);
	if (comment) {
		result = result.replace(/(\nK:)/, `\nN:${comment}$1`);
	}
	return result;
}

function convertStandardPolka(t, comment = defaultCommentForPolkaConversion) {
	const meter = getMeter(t);
	if (!Array.isArray(meter) || !meter || !meter[0] === 2 || !meter[1] === 4) {
		throw new Error("invalid meter");
	}

	let result = //toggleMeter_4_4_to_4_2(reel, meter);
		toggleMeterDoubling(t, [2, 4], [4, 4], meter);
	if (comment) {
		result = result.replace(/(\nK:)/, `\nN:${comment}$1`);
	}
	return result;
}

/**
 * Adjusts bar lengths and M field to alter a
 * hornpipe written in the normal way (M:6/8) so it’s
 * written with M:12/8.
 * Bars are twice as long.
 * @param {string} hornpipe
 * @param {string} comment - when non falsey, the comment will be injected as an N: header

 * @returns
 */
function convertStandardHornpipe(
	hornpipe,
	comment = defaultCommentForHornpipeConversion
) {
	const meter = getMeter(hornpipe);
	if (!Array.isArray(meter) || !meter || !meter[0] === 4 || !meter[1] === 4) {
		throw new Error("invalid meter");
	}

	let result = toggleMeter_4_4_to_4_2(hornpipe, meter);

	if (comment) {
		result = result.replace(/(\nK:)/, `\nN:${comment}$1`);
	}
	return result;
}
function doubleBarLength(abc, comment = null) {
	const meter = getMeter(abc);
	if (!Array.isArray(meter) || !meter) {
		throw new Error("invalid meter");
	}
	// const newMeter = [meter[0], meter[1]];
	// if ([16, 8, 4, 2].indexOf(meter[1]) >= 0) newMeter[1] /= 2;
	// else {
	// 	newMeter[0] *= 2;
	// }
	const newMeter = [meter[0] * 2, meter[1]];

	let result = //toggleMeter_4_4_to_4_2(reel, meter);
		toggleMeterDoubling(abc, meter, newMeter, meter);
	if (comment) {
		result = result.replace(/(\nK:)/, `\nN:${comment}$1`);
	}
	return result;
}

/**
 * Adjusts bar lengths and L field to convert a
 * reel written in the abnormal way (M:4/4 L:1/16) to the same reel
 * written with M:4/4 L:1/8, the normal or standard way.
 * Bars are half as long, and the quick notes are quavers
 * rather than semiquavers. Inverse operation to convertStandardReel
 * @param {string} reel
 * @param {string} comment - when non falsey, the comment (as an N:) will removed from the header
 * @param {bool} withSemiquavers - when unflagged, the original reel was written in M:4/2 L:1/8
 * @returns
 */
function convertToStandardReel(
	reel,
	comment = defaultCommentForReelConversion,
	withSemiquavers = true
) {
	if (withSemiquavers) {
		reel = reel
			.replace(/\nM:\s*4\/4/, "\nM:4/2")
			.replace(/\nL:\s*1\/16/, "\nL:1/8");
	}

	const unitLength = getUnitLength(reel);
	if (unitLength.den !== 8) {
		throw new Error("invalid L header");
	}
	const meter = getMeter(reel);
	if (!Array.isArray(meter) || !meter || !meter[0] === 4 || !meter[1] === 4) {
		throw new Error("invalid meter");
	}

	let result = // toggleMeter_4_4_to_4_2(reel, meter);
		toggleMeterDoubling(reel, [4, 4], [4, 2], meter);
	if (comment) {
		result = result.replace(`\nN:${comment}`, "");
	}
	return result;
}
/**
 * Adjusts bar lengths to rewrite a
 * jig written in the abnormal way (M:12/8) to M:6/8, the normal or standard way.
 * Bars are half as long. Inverse operation to convertStandardJig
 * @param {string} jig
 * @param {string} comment - when non falsey, the comment (as an N:) will removed from the header
 * @param {bool} withSemiquavers - when unflagged, the original jig was written in M:4/2 L:1/8
 * @returns
 */
function convertToStandardJig(jig, comment = defaultCommentForJigConversion) {
	const unitLength = getUnitLength(jig);
	if (unitLength.den !== 8) {
		throw new Error("invalid L header");
	}
	const meter = getMeter(jig);
	if (!Array.isArray(meter) || !meter || !meter[0] === 12 || !meter[1] === 8) {
		throw new Error("invalid meter");
	}

	let result = toggleMeter_6_8_to_12_8(jig); // toggleMeter_4_4_to_4_2(jig, meter);
	if (comment) {
		result = result.replace(`\nN:${comment}`, "");
	}
	return result;
}

function convertToStandardPolka(t, comment = defaultCommentForPolkaConversion) {
	const meter = getMeter(t);
	if (!Array.isArray(meter) || !meter || !meter[0] === 4 || !meter[1] === 4) {
		throw new Error("invalid meter");
	}

	let result = toggleMeterDoubling(t, [2, 4], [4, 4], meter);
	if (comment) {
		result = result.replace(`\nN:${comment}`, "");
	}
	return result;
}

function convertToStandardHornpipe(
	hornpipe,
	comment = defaultCommentForHornpipeConversion
) {
	const unitLength = getUnitLength(hornpipe);
	if (unitLength.den !== 8) {
		throw new Error("invalid L header");
	}
	const meter = getMeter(hornpipe);
	if (!Array.isArray(meter) || !meter || !meter[0] === 4 || !meter[1] === 2) {
		throw new Error("invalid meter");
	}

	let result = toggleMeter_4_4_to_4_2(hornpipe); // toggleMeter_4_4_to_4_2(jig, meter);
	if (comment) {
		result = result.replace(`\nN:${comment}`, "");
	}
	return result;
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
 * Get the first N complete or partial musical bars from ABC notation, with or without the anacrusis
 * Preserves all formatting, comments, spacing, and line breaks
 * @param {string} abc - ABC notation
 * @param {number|Fraction} numBars - Number of musical bars to extract (can be fractional, e.g., 1.5 or new Fraction(3,2))
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
	// Convert numBars to Fraction if it’s a number
	const numBarsFraction =
		typeof numBars === "number" ? new Fraction(numBars) : numBars;

	// Estimate maxBars needed for parsing
	const estimatedMaxBars = Math.ceil(numBarsFraction.toNumber()) * 2 + 2;

	// Parse ABC
	const parsed = parseAbc(abc, { maxBars: estimatedMaxBars });
	const { bars, headerLines, barLines, musicText, meter } = parsed;

	if (bars.length === 0 || barLines.length === 0) {
		throw new Error("No bars found");
	}

	// Determine which bar number to stop after
	// We need to account for fractional bars, anacrusis handling, etc.
	const wholeBarsNeeded = Math.ceil(numBarsFraction.toNumber());
	const stopAfterBarNumber = wholeBarsNeeded + 1; // Add buffer for safety

	// Get bar info up to the bar number we need
	const barInfo = getBarInfo(bars, barLines, meter, {
		barNumbers: true,
		isPartial: true,
		cumulativeDuration: true,
		stopAfterBarNumber
	});

	const enrichedBarLines = barInfo.barLines;

	// Detect if there’s an anacrusis
	const firstNumberedBarLine = enrichedBarLines.find(
		(bl) => bl.barNumber !== null
	);
	const hasPickup =
		firstNumberedBarLine &&
		firstNumberedBarLine.barNumber === 0 &&
		firstNumberedBarLine.isPartial === true;

	// Filter headers if requested
	const filteredHeaders = filterHeaders(headerLines, headersToStrip);

	// Calculate the expected duration per musical bar
	const expectedBarDuration = new Fraction(meter[0], meter[1]);
	const targetDuration = expectedBarDuration.multiply(numBarsFraction);

	// Determine starting position and how much duration we need to accumulate
	let startPos = 0;
	let remainingDurationNeeded = targetDuration.clone();
	let countingFromBarNumber = 0;

	if (hasPickup) {
		if (withAnacrucis) {
			// Include anacrusis in output
			startPos = 0;
			if (countAnacrucisInTotal) {
				// Subtract anacrusis duration from target
				const anacrusisBarLine = enrichedBarLines.find(
					(bl) => bl.barNumber === 0
				);
				if (anacrusisBarLine && anacrusisBarLine.cumulativeDuration) {
					const anacrusisDuration =
						anacrusisBarLine.cumulativeDuration.sinceLastBarLine;
					remainingDurationNeeded =
						remainingDurationNeeded.subtract(anacrusisDuration);
				}
				countingFromBarNumber = 1; // Start counting from first complete bar
			} else {
				// Don’t count anacrusis - we want full numBars after it
				countingFromBarNumber = 1;
			}
		} else {
			// Skip anacrusis - start after its bar line
			const anacrusisBarLineIdx = enrichedBarLines.findIndex(
				(bl) => bl.barNumber === 0
			);
			if (anacrusisBarLineIdx >= 0) {
				const anacrusisBarLine = enrichedBarLines[anacrusisBarLineIdx];
				startPos = anacrusisBarLine.sourceIndex + anacrusisBarLine.sourceLength;
			}
			countingFromBarNumber = 1;
		}
	} else {
		// No anacrusis
		startPos = 0;
		countingFromBarNumber = 0;
	}

	// Determine which bar numbers we need based on remaining duration
	const wholeBarsInRemaining = Math.floor(
		remainingDurationNeeded.divide(expectedBarDuration).toNumber()
	);
	const fractionalPart = remainingDurationNeeded.subtract(
		expectedBarDuration.multiply(new Fraction(wholeBarsInRemaining, 1))
	);

	const needsFractionalBar = fractionalPart.compare(new Fraction(0, 1)) > 0;
	const finalTargetBarNumber =
		countingFromBarNumber +
		wholeBarsInRemaining +
		(needsFractionalBar ? 0 : -1);

	// Find end position
	let endPos = startPos;
	let foundEnd = false;

	// Find all bar lines with our target bar numbers
	const relevantBarLines = enrichedBarLines.filter(
		(bl) =>
			bl.barNumber !== null &&
			bl.barNumber >= countingFromBarNumber &&
			bl.barNumber <= finalTargetBarNumber
	);

	if (!needsFractionalBar) {
		// For whole bars, find the bar line at finalTargetBarNumber
		const finalBarLine = relevantBarLines.find(
			(bl) => bl.barNumber === finalTargetBarNumber
		);
		if (finalBarLine) {
			endPos = finalBarLine.sourceIndex + finalBarLine.sourceLength;
			foundEnd = true;
		}
	} else {
		// For fractional bars, we need to do duration counting within bars with finalTargetBarNumber
		// Note: there may be multiple segments with the same barNumber (partial bars)

		let accumulated = new Fraction(0, 1);

		// Iterate through bars and accumulate duration for bars with finalTargetBarNumber
		for (let i = 0; i < bars.length; i++) {
			const bar = bars[i];
			if (bar.length === 0) continue;

			// Find the bar line that follows this bar to get its barNumber
			const barLineIdx = enrichedBarLines.findIndex(
				(bl) => bl.sourceIndex >= bar[bar.length - 1].sourceIndex
			);

			if (barLineIdx < 0) continue;

			const barLine = enrichedBarLines[barLineIdx];

			if (barLine.barNumber === finalTargetBarNumber) {
				// This bar segment is part of our target bar number
				for (const token of bar) {
					if (!token.duration) {
						continue;
					}

					const newAccumulated = accumulated.add(token.duration);

					if (newAccumulated.compare(fractionalPart) >= 0) {
						// Found the position - include this token
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
						foundEnd = true;
						break;
					}

					accumulated = newAccumulated;
				}

				if (foundEnd) break;
			}
		}
	}

	// Fallback: if we didn’t find an end, use the last available position
	if (!foundEnd || endPos === startPos) {
		endPos = musicText.length;
	}

	// Reconstruct ABC
	return `${filteredHeaders.join("\n")}\n${musicText.substring(
		startPos,
		endPos
	)}`;
}

function canDoubleBarLength(abc) {
	const meter = getMeter(abc),
		l = getUnitLength(abc),
		rhythm = getHeaderValue(abc, "R");
	if (
		!rhythm ||
		["reel", "hornpipe", "jig", "polka"].indexOf(rhythm.toLowerCase()) < 0
	) {
		return false;
	}
	return (
		(!abc.match(/\[M:/) && //inline meter marking
			!abc.match(/\[L:/) &&
			(((rhythm === "reel" || rhythm === "hornpipe") &&
				l.equals(new Fraction(1, 8)) &&
				meter[0] === 4 &&
				meter[1] === 4) ||
				(rhythm === "jig" && meter[0] === 6 && meter[1] === 8))) ||
		(rhythm === "polka" && meter[0] === 2 && meter[1] === 4)
	);
}
function canHalveBarLength(abc) {
	const meter = getMeter(abc),
		l = getUnitLength(abc),
		rhythm = getHeaderValue(abc, "R");
	if (
		!rhythm ||
		["reel", "hornpipe", "jig", "polka"].indexOf(rhythm.toLowerCase()) < 0
	) {
		return false;
	}

	return (
		!abc.match(/\[M:/) && //inline meter marking
		!abc.match(/\[L:/) &&
		((rhythm === "reel" &&
			l.equals(new Fraction(1, 16)) &&
			meter[0] === 4 &&
			meter[1] === 4) ||
			((rhythm === "reel" || rhythm === "hornpipe") &&
				l.equals(new Fraction(1, 8)) &&
				meter[0] === 4 &&
				meter[1] === 2) ||
			(rhythm === "jig" && meter[0] === 12 && meter[1] === 8) ||
			(rhythm === "polka" && meter[0] === 4 && meter[1] === 4))
	);
}

module.exports = {
	canDoubleBarLength,
	canHalveBarLength,
	convertStandardJig,
	convertStandardHornpipe,
	convertStandardPolka,
	convertStandardReel,
	convertToStandardJig,
	convertToStandardHornpipe,
	convertToStandardPolka,
	convertToStandardReel,
	defaultCommentForReelConversion,
	doubleBarLength,
	filterHeaders,
	getFirstBars,
	hasAnacrucis,
	normaliseKey,
	toggleMeter_4_4_to_4_2,
	toggleMeter_6_8_to_12_8,
	toggleMeterDoubling
};
