const { Fraction } = require("../math.js");

function processSkippedBarLines(barLines, skippedBarLineIndexes) {
	for (let i = 0; i < skippedBarLineIndexes.length; i++) {
		const skippedIndex = skippedBarLineIndexes[i];
		if (skippedIndex === 0) continue; //don't see how this can happen, but seems best to check
		//copy any properties in the preceding barLine not in the skipped barLine over to the skipped barLine
		barLines[skippedIndex] = {
			...barLines[skippedIndex - 1],
			...barLines[skippedIndex],
		};
	}
}

/**
 * Enriches parsed ABC bar data with musical bar information
 *
 * Analyses bars and bar lines to add:
 * - barNumber: Index of the musical bar (null for initial bar lines).
 *   - For tunes without anacrusis: first complete bar is numbered 0, then 1, 2, 3...
 *   - For tunes with anacrusis (pickup bar): the anacrusis is numbered 0, then the first
 *     complete bar is numbered 1, 2, 3...
 *   - Initial bar lines (before any music) have barNumber: null
 *   - Consecutive partial bars within the same musical bar share the same barNumber
 * - variantId: Index of variant ending (0 for first ending, 1 for second, etc.). Only present within variant endings.
 * - isPartial: Flag for bar lines whose preceding segment is shorter than a complete bar as defined by the current meter.
 * - completesMusicBar: Flag (only on partial barLines) indicating the accumulated duration from previous partial segment(s) completes a musical bar.
 * - cumulativeDuration: Duration tracking for bar segments (sinceLastBarLine and sinceLastComplete).
 * - midpoints: Positions where bars should be split (when divideBarsBy specified).
 *
 * A "musical bar" is defined by the meter (e.g., 4/4 means 4 quarter notes).
 * Bar lines can create "partial bars" that split a musical bar. This commonly happens with repeats and pickup notes.
 * Variant endings can appear in the middle of a complete bar without splitting it.
 * Consecutive partial bars within the same musical bar will have the same barNumber.
 * Variant endings create alternative paths, so duration tracking follows one path at a time.
 * All bars at the same position across different variant endings share the same barNumber
 * but have different variantId values (0 for first ending, 1 for second, etc.).
 *
 * Meter and unit length changes: When a barline has newMeter or newUnitLength fields (from inline
 * field changes), the new meter/length is applied to the following bar. The fullBarDuration is
 * recalculated accordingly. Partial bar accumulation continues under the new meter.
 *
 * IMPORTANT: The music segment associated with a bar line is the segment PRECEDING the bar line.
 * Example: In `A4|B4||c2d2|]`, the segment for `|` is `A4`, for `||` is `B4`, and for `|]` is `c2d2`.
 *
 * Examples of isPartial and completesMusicBar flags:
 *
 * Example 1: `|:D2|C4|D2:|E2|F4|]` (M:4/4, L:1/4)
 *   - After D2 (anacrusis): isPartial: true, completesMusicBar: undefined
 *   - After C4: isPartial: undefined (complete bar)
 *   - After D2 (before :|): isPartial: true, completesMusicBar: undefined
 *   - After E2: isPartial: true, completesMusicBar: true (D2 + E2 = 4 beats)
 *   - After F4: isPartial: undefined
 *
 * Example 2: `C4|D2[1D2:|[2FA||` (M:4/4, L:1/4)
 *   - After C4: isPartial: undefined
 *   - After [1D2: isPartial: true, completesMusicBar: true (D2 + [1D2 = 4 beats)
 *   - After [2FA: isPartial: true, completesMusicBar: true (D2 + FA = 4 beats)
 *
 * Example 3: `D2|C4|[1D2:|[2DF||` (M:4/4, L:1/4)
 *   - After D2 (anacrusis): isPartial: true, completesMusicBar: undefined
 *   - After C4: isPartial: undefined
 *   - After [1D2: isPartial: true, completesMusicBar: undefined (only 2 beats)
 *   - After [2DF: isPartial: true, completesMusicBar: undefined (only 2 beats)
 *
 * Example 4: `C4|[M:3/4]D3|E3|` (M:4/4 → 3/4, L:1/4)
 *   - After C4: barNumber: 0 (complete 4/4 bar)
 *   - After D3: barNumber: 1 (complete 3/4 bar under new meter)
 *   - After E3: barNumber: 2 (complete 3/4 bar)
 *
 * Not handled: Change of meter or unit length mid-bar (inline M: or L: fields within a bar).
 *
 * @param {Array<Array<Object>>} bars - Array of bar arrays from parseAbc
 * @param {Array<Object>} barLines - Array of barLine objects from parseAbc
 * @param {Array<number>} meter - [numerator, denominator] from parseAbc
 * @param {Object} options - Configuration options
 * @param {boolean} options.barNumbers - Add barNumber to each barLine. Default: true.
 * @param {boolean} options.isPartial - Add isPartial flag to partial barLines. Default: true.
 * @param {boolean} options.cumulativeDuration - Add duration tracking to barLines. Default: true.
 * @param {number|null} options.divideBarsBy - Find midpoints for splitting (only 2 supported). Default: null.
 * @param {number|null} options.stopAfterBarNumber - Stop processing after assigning this bar number. Default: null.
 * @returns {Object} - { barLines: enriched array, midpoints: insertion positions }
 */
function getBarInfo(bars, barLines, meter, options = {}) {
	const {
		barNumbers = true,
		isPartial = true,
		cumulativeDuration = true,
		divideBarsBy = null,
		stopAfterBarNumber = null,
	} = options;

	if (divideBarsBy !== null && divideBarsBy !== 2) {
		throw new Error("divideBarsBy currently only supports value 2");
	}

	// Track current meter (can change via inline fields)
	let currentMeter = [...meter];
	let fullBarDuration = new Fraction(currentMeter[0], currentMeter[1]);
	const midpoints = [];

	let currentBarNumber = 0;
	let durationSinceLastComplete = new Fraction(0, 1);
	let lastCompleteBarLineIdx = -1;
	let barLineOffset = 0;

	// Variant ending tracking
	let inVariantGroup = false;
	let currentVariantId = null;
	let variantBranchPoint = null; // Stores state at the start of variant group
	let maxBarNumberInVariantGroup = -1; // Track highest bar number across all variants
	let variantCounter = 0; // Sequential counter for variant IDs (0, 1, 2, ...)

	const skippedBarLineIndexes = [];

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
		let barLineIdx = barIdx + barLineOffset;

		// Check if the previous barline had a meter or unit length change
		if (barLineIdx > 0) {
			const prevBarLine = barLines[barLineIdx - 1];

			if (prevBarLine.newMeter) {
				currentMeter = [...prevBarLine.newMeter];
				fullBarDuration = new Fraction(currentMeter[0], currentMeter[1]);
			}

			// Note: newUnitLength doesn't directly affect fullBarDuration
			// (token durations are already calculated in the correct units)
		}

		// Calculate duration of this bar segment
		// Process tokens and handle variant endings during traversal
		let barDuration = new Fraction(0, 1);
		let variantEncountered = false;

		// check if this barLine actually comes after the bar (compare source positions)
		// If the bar starts after the barLine, it means there are consecutive barLines
		// with no notes between them, so we skip the current barLine and keep skipping
		// until we find the next barLine that is after the bar.
		{
			let barLine = barLines[barLineIdx];
			while (
				bar.length > 0 &&
				barLine &&
				bar[0].sourceIndex > barLine.sourceIndex &&
				barLineIdx < barLines.length
			) {
				skippedBarLineIndexes.push(barLineIdx);
				barLineIdx++;
				barLineOffset++;
				barLine = barLines[barLineIdx];
			}
		}

		for (const token of bar) {
			// Add token duration first (before checking for variants)
			if (token.duration) {
				barDuration = barDuration.add(token.duration);
			}

			// Check for variant ending after processing duration
			if (token.isVariantEnding && !variantEncountered) {
				variantEncountered = true;

				if (!inVariantGroup) {
					// Starting a new variant group - store state including duration accumulated up to this point
					// Add current barDuration to get the state before this variant token
					const durationBeforeVariant =
						durationSinceLastComplete.add(barDuration);

					inVariantGroup = true;
					variantBranchPoint = {
						barNumber: currentBarNumber,
						durationSinceLastComplete: durationBeforeVariant.clone(),
						lastCompleteBarLineIdx: lastCompleteBarLineIdx,
						meter: [...currentMeter],
						fullBarDuration: fullBarDuration.clone(),
					};
					variantCounter = 0;
					currentVariantId = variantCounter;
					maxBarNumberInVariantGroup = currentBarNumber - 1;
				} else {
					// Continuing in same variant group - restore state from branch point
					variantCounter++;
					currentVariantId = variantCounter;
					currentBarNumber = variantBranchPoint.barNumber;
					durationSinceLastComplete =
						variantBranchPoint.durationSinceLastComplete.clone();
					lastCompleteBarLineIdx = variantBranchPoint.lastCompleteBarLineIdx;
					currentMeter = [...variantBranchPoint.meter];
					fullBarDuration = variantBranchPoint.fullBarDuration.clone();
					// Discard barDuration accumulated so far (it's from the wrong variant path)
					barDuration = token.duration
						? token.duration.clone()
						: new Fraction(0, 1);
				}
			}
		}

		durationSinceLastComplete = durationSinceLastComplete.add(barDuration);

		// Get the bar line that follows this bar
		if (barLineIdx < barLines.length) {
			const barLine = barLines[barLineIdx];

			// Determine if this bar segment is partial (shorter than full bar duration)
			const isPartialBar = barDuration.compare(fullBarDuration) < 0;

			// Check if accumulated partials complete a full bar
			const completesFullBar =
				durationSinceLastComplete.compare(fullBarDuration) >= 0;

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
					} else if (completesFullBar) {
						// If partial bars have accumulated to a full bar, mark as complete
						currentBarNumber = barLine.barNumber + 1;
						lastCompleteBarLineIdx = barLineIdx;
					} else {
						// Partial bar that doesn't complete - still need to update currentBarNumber
						// so that the next complete bar numbers correctly
						currentBarNumber = barLine.barNumber + 1;
					}
				} else {
					// Complete bar line
					barLine.barNumber = currentBarNumber;
					currentBarNumber++;
					lastCompleteBarLineIdx = barLineIdx;
				}

				// Track max bar number if in variant group
				if (inVariantGroup) {
					maxBarNumberInVariantGroup = Math.max(
						maxBarNumberInVariantGroup,
						barLine.barNumber
					);
				}

				// Check if we should stop processing
				if (
					stopAfterBarNumber !== null &&
					barLine.barNumber === stopAfterBarNumber
				) {
					// Stop here - return what we have so far
					processSkippedBarLines(barLines, skippedBarLineIndexes);
					return {
						barLines: barLines.slice(0, barLineIdx + 1),
						midpoints,
					};
				}
			}

			// Add variantId if we're in a variant ending
			if (inVariantGroup && currentVariantId !== null) {
				barLine.variantId = currentVariantId;
			}

			// Add isPartial flag (only when true)
			if (isPartialBar) {
				if (isPartial) {
					barLine.isPartial = true;
				}

				// Add completesMusicBar flag for partials that complete a musical bar
				if (completesFullBar) {
					barLine.completesMusicBar = true;
				}
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
			if (completesFullBar || barLine.barNumber === 0) {
				durationSinceLastComplete = new Fraction(0, 1);
			}

			// Check if we're exiting a variant group (section break)
			// Only exit if the next bar doesn't contain a variant ending
			if (inVariantGroup && barLine.isSectionBreak) {
				let nextBarHasVariant = false;
				if (barIdx + 1 < bars.length) {
					const nextBar = bars[barIdx + 1];
					for (const token of nextBar) {
						if (token.isVariantEnding) {
							nextBarHasVariant = true;
							break;
						}
					}
				}

				if (!nextBarHasVariant) {
					// No more variants coming, exit the group
					inVariantGroup = false;
					currentVariantId = null;
					// Set currentBarNumber to max + 1 to continue numbering after variants
					currentBarNumber = maxBarNumberInVariantGroup + 1;
					// Only update lastCompleteBarLineIdx if the variant ended with a complete bar
					// If it ended partial, keep the previous lastCompleteBarLineIdx so the next
					// partial bar continues with the same bar number
					if (completesFullBar) {
						lastCompleteBarLineIdx = barLineIdx;
						durationSinceLastComplete = new Fraction(0, 1);
					}
					// If the variant ended partial, durationSinceLastComplete is kept to continue accumulating
					variantBranchPoint = null;
					maxBarNumberInVariantGroup = -1;
					variantCounter = 0;
				}
			}
		}
	}

	// Calculate midpoints if requested
	if (divideBarsBy === 2) {
		// Track meter for midpoint calculation
		let midpointMeter = [...meter];
		let halfBarDuration = new Fraction(
			midpointMeter[0],
			midpointMeter[1]
		).divide(new Fraction(2, 1));

		for (let barIdx = 0; barIdx < bars.length; barIdx++) {
			const barLineIdx = barIdx + barLineOffset;

			// Update meter if previous barline had a change
			if (barLineIdx > 0 && barLines[barLineIdx - 1].newMeter) {
				midpointMeter = [...barLines[barLineIdx - 1].newMeter];
				halfBarDuration = new Fraction(
					midpointMeter[0],
					midpointMeter[1]
				).divide(new Fraction(2, 1));
			}

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

	processSkippedBarLines(barLines, skippedBarLineIndexes);
	return {
		barLines,
		midpoints,
	};
}

module.exports = {
	getBarInfo,
};
