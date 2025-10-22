const { Fraction } = require("../math.js");

// ============================================================================
// ABC HEADER PARSING
// ============================================================================
//
// Handles extraction of header fields from ABC notation:
// - Key signature (K:)
// - Meter/time signature (M:)
// - Unit note length (L:)
// - Line metadata (comments, continuations)
//
// ============================================================================

/**
 * Extract key signature from ABC header
 *
 * @param {string} abc - ABC notation string
 * @returns {string} - Tonic note (e.g., 'C', 'D', 'G')
 * @throws {Error} - If no key signature found
 */
function getTonalBase(abc) {
	const keyMatch = abc.match(/^K:\s*([A-G])/m);
	if (!keyMatch) {
		throw new Error("No key signature found in ABC");
	}
	return keyMatch[1].toUpperCase();
}

/**
 * Extract meter/time signature from ABC header
 *
 * @param {string} abc - ABC notation string
 * @returns {[number, number]} - Meter as [numerator, denominator] (e.g., [3, 4] for 3/4 time)
 */
function getMeter(abc) {
	const meterMatch = abc.match(/^M:\s*(\d+)\/(\d+)/m);
	if (meterMatch) {
		return [parseInt(meterMatch[1]), parseInt(meterMatch[2])];
	}
	return [4, 4]; // Default to 4/4
}

/**
 * Extract unit note length as a Fraction object
 *
 * @param {string} abc - ABC notation string
 * @returns {Fraction} - Unit length (e.g., 1/8, 1/4)
 */
function getUnitLength(abc) {
	const lengthMatch = abc.match(/^L:\s*(\d+)\/(\d+)/m);
	if (lengthMatch) {
		return new Fraction(parseInt(lengthMatch[1]), parseInt(lengthMatch[2]));
	}
	return new Fraction(1, 8); // Default to 1/8
}

/**
 * Process ABC lines: extract music lines with metadata
 * Handles comments, line continuations, and separates headers from music
 * Preserves newline positions for layout tracking
 *
 * @param {string} abc - ABC notation string
 * @returns {object} - { musicText, lineMetadata, newlinePositions, headerLines, headerEndIndex }
 */
function getMusicLines(abc) {
	const lines = abc.split("\n");
	const musicLines = [];
	const lineMetadata = [];
	const newlinePositions = [];
	const headerLines = [];
	let headerEndIndex = 0;
	let inHeaders = true;
	let currentPos = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		let trimmed = line.trim();

		// Skip empty lines and comment-only lines
		if (trimmed === "" || trimmed.startsWith("%")) {
			if (inHeaders) {
				headerEndIndex = i + 1;
			}
			continue;
		}

		// Check for header lines
		if (inHeaders && trimmed.match(/^[A-Z]:/)) {
			headerLines.push(line);
			headerEndIndex = i + 1;
			continue;
		}
		inHeaders = false;

		// Extract inline comment if present
		const commentMatch = trimmed.match(/\s*%(.*)$/);
		const comment = commentMatch ? commentMatch[1].trim() : null;

		// Check for line continuation
		const hasContinuation = trimmed.match(/\\\s*(%|$)/) !== null;

		// Remove inline comments and line continuation marker
		trimmed = trimmed.replace(/\s*%.*$/, "").trim();
		trimmed = trimmed.replace(/\\\s*$/, "").trim();

		if (trimmed) {
			musicLines.push(trimmed);
			lineMetadata.push({
				lineIndex: i,
				originalLine: line,
				content: trimmed,
				comment,
				hasContinuation,
			});

			// Track position where newline would be (unless continuation)
			if (!hasContinuation && musicLines.length > 1) {
				newlinePositions.push(currentPos);
			}

			currentPos += trimmed.length + 1; // +1 for the space we'll add when joining
		}
	}

	return {
		musicText: musicLines.join("\n"),
		lineMetadata,
		newlinePositions,
		headerLines,
		headerEndIndex,
	};
}

module.exports = {
	getTonalBase,
	getMeter,
	getUnitLength,
	getMusicLines,
};
