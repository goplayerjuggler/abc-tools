const { Fraction } = require("../math.js");

/**
 * Enriches parsed ABC bar data with musical bar information
 *
 * Analyzes bars and bar lines to add:
 * - barNumber: Index of the musical bar (null for initial bar lines)
 * - isPartial: Flag for bar lines that occur mid-musical-bar
 * - cumulativeDuration: Duration tracking for bar segments
 * - midpoints: Positions where bars should be split (when divideBarsBy specified)
 *
 * A "musical bar" is defined by the meter (e.g., 4/4 means 4 quarter notes).
 * Bar lines can create "partial bars" when repeats or variant endings split a musical bar.
 * Consecutive partial bars within the same musical bar will have the same barNumber.
 * Variant endings create alternative paths, so duration tracking follows one path at a time.
 *
 * @param {Array<Array<Object>>} bars - Array of bar arrays from parseAbc
 * @param {Array<Object>} barLines - Array of barLine objects from parseAbc
 * @param {Array<number>} meter - [numerator, denominator] from parseAbc
 * @param {Object} options - Configuration options
 * @param {boolean} options.barNumbers - Add barNumber to each barLine. Default value: true.
 * @param {boolean} options.isPartial - Add isPartial flag to partial barLines. Default value: true.
 * @param {boolean} options.cumulativeDuration - Add duration tracking to barLines. Default value: true.
 * @param {number|null} options.divideBarsBy - Find midpoints for splitting (only 2 supported)
 * @returns {Object} - { barLines: enriched array, midpoints: insertion positions }
 */
function getBarInfo(bars, barLines, meter, options = {}) {
	const {
		barNumbers = true,
		isPartial = true,
		cumulativeDuration = true,
		divideBarsBy = null,
	} = options;

	if (divideBarsBy !== null && divideBarsBy !== 2) {
		throw new Error("divideBarsBy currently only supports value 2");
	}
	if (!barLines || barLines.length < bars.length) {
		throw new Error(
			"currently not handling bars without a bar line at the end"
		);
	}

	const fullBarDuration = new Fraction(meter[0], meter[1]);
	const midpoints = [];

	let currentBarNumber = 0;
	let durationSinceLastComplete = new Fraction(0, 1);
	let lastCompleteBarLineIdx = -1;
	let barLineOffset = 0;

	// Check for initial bar line (before any music)
	if (
		bars.length > 0 &&
		bars[0].length > 0 &&
		barLines.length > 0 &&
		barLines[0].sourceIndex < bars[0][0].sourceIndex
	) {
		// Initial bar line exists
		if (barNumbers) {
			barLines[0].barNumber = null;
		}
		barLineOffset = 1;
	}

	// Process each bar and its following bar line
	for (let barIdx = 0; barIdx < bars.length; barIdx++) {
		const bar = bars[barIdx];
		const barLineIdx = barIdx + barLineOffset;

		// Check if this bar starts with a variant ending
		const startsWithVariant = bar.length > 0 && bar[0].isVariantEnding;

		// If this bar starts with a variant, reset duration tracking
		// (variant endings create alternative paths)
		if (startsWithVariant && lastCompleteBarLineIdx >= 0) {
			durationSinceLastComplete = new Fraction(0, 1);
		}

		// Calculate duration of this bar segment
		let barDuration = new Fraction(0, 1);
		for (const token of bar) {
			if (token.duration) {
				barDuration = barDuration.add(token.duration);
			}
		}

		durationSinceLastComplete = durationSinceLastComplete.add(barDuration);

		// Get the bar line that follows this bar
		if (barLineIdx < barLines.length) {
			const barLine = barLines[barLineIdx];

			// Determine if this bar line is partial
			// A bar line is partial if THIS bar segment is less than full bar duration
			const isPartialBar = barDuration.compare(fullBarDuration) < 0;

			// Add barNumber
			if (barNumbers) {
				if (isPartialBar) {
					// Partial bar line: barNumber is lastComplete + 1
					barLine.barNumber =
						lastCompleteBarLineIdx >= 0
							? barLines[lastCompleteBarLineIdx].barNumber + 1
							: 0;

					// If this is the initial anacrusis (barNumber 0), mark it as complete for numbering purposes
					if (barLine.barNumber === 0) {
						lastCompleteBarLineIdx = barLineIdx;
						currentBarNumber = 1; // Next complete bar will be bar 1
					}

					// If partial bars have accumulated to a full bar, increment currentBarNumber
					if (durationSinceLastComplete.compare(fullBarDuration) >= 0) {
						currentBarNumber = barLine.barNumber + 1;
						lastCompleteBarLineIdx = barLineIdx;
					}
				} else {
					// Complete bar line
					barLine.barNumber = currentBarNumber;
					currentBarNumber++;
					lastCompleteBarLineIdx = barLineIdx;
				}
			}

			// Add isPartial flag (only when true)
			if (isPartial && isPartialBar) {
				barLine.isPartial = true;
			}

			// Add cumulative duration
			if (cumulativeDuration) {
				barLine.cumulativeDuration = {
					sinceLastBarLine: barDuration.clone(),
					sinceLastComplete: durationSinceLastComplete.clone(),
				};
			}

			// Reset duration tracking if this completes a musical bar
			// Also reset after initial anacrusis (barNumber 0)
			if (lastCompleteBarLineIdx === barLineIdx || barLine.barNumber === 0) {
				durationSinceLastComplete = new Fraction(0, 1);
			}
		}
	}

	// Calculate midpoints if requested
	if (divideBarsBy === 2) {
		const halfBarDuration = fullBarDuration.divide(new Fraction(2, 1));

		for (let barIdx = 0; barIdx < bars.length; barIdx++) {
			const bar = bars[barIdx];
			let accumulated = new Fraction(0, 1);

			// Check if this bar starts with a variant - if so, skip it
			// (variant endings already create splits)
			if (bar.length > 0 && bar[0].isVariantEnding) {
				continue;
			}

			// Find the halfway point in this bar
			for (let tokenIdx = 0; tokenIdx < bar.length; tokenIdx++) {
				const token = bar[tokenIdx];

				// If we hit a variant ending before halfway, don't split
				if (token.isVariantEnding) {
					break;
				}

				if (!token.duration) {
					continue;
				}

				const prevAccumulated = accumulated.clone();
				accumulated = accumulated.add(token.duration);

				// Check if we just crossed the halfway point
				if (
					prevAccumulated.compare(halfBarDuration) < 0 &&
					accumulated.compare(halfBarDuration) >= 0
				) {
					// Insert after this token
					let insertPos = token.sourceIndex + token.sourceLength;
					if (token.spacing && token.spacing.whitespace) {
						insertPos += token.spacing.whitespace.length;
					}
					midpoints.push(insertPos);
					break;
				}
			}
		}
	}

	return {
		barLines,
		midpoints,
	};
}

module.exports = {
	getBarInfo,
};
