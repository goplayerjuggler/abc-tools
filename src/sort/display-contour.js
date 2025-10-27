const { decodeChar } = require("./contour-sort");

/**
 * Converts a scale position integer to a string representation with degree and octave notation.
 *
 * Positions represent distance from the base note in a 7-degree scale:
 * - Positions 0-6: Base octave, represented as '1', '2', ..., '7'
 * - Positions 7+: Higher octaves, represented with apostrophes: '1\'', '2\'', etc.
 *   Each additional octave adds another apostrophe
 * - Positions <0: Lower octaves, represented with commas: '1,', '2,', etc.
 *   Each additional octave below adds another comma
 *
 * @param {number} p - The position (integer distance from base note)
 * @returns {string} The scale degree notation (e.g., '1', '5\'', '3,,')
 *
 * @example
 * positionToString(0)   // returns '1'
 * positionToString(6)   // returns '7'
 * positionToString(7)   // returns '1\''
 * positionToString(14)  // returns '1\'\''
 * positionToString(-1)  // returns '7,'
 * positionToString(-7)  // returns '7,,'
 */
function positionToString(p) {
	if (p >= 0) {
		// Positive positions (base octave and above)
		const nbOctaves = Math.floor(p / 7);
		const degree = (p % 7) + 1;
		const octaveMarker = "'".repeat(nbOctaves);
		return `${degree}${octaveMarker}`;
	} else {
		// Negative positions (octaves below base)
		const nbOctaves = Math.floor((-p - 1) / 7) + 1;
		const degree = (((p % 7) + 7) % 7) + 1;
		const octaveMarker = ",".repeat(nbOctaves);
		return `${degree}${octaveMarker}`;
	}
}
/**
 *
 * @param {*} char
 * @returns {number|string}
 */
function displayOneAsText(char, showHeld = false) {
	const { position, isHeld, isSilence } = decodeChar(char);
	if (isSilence) return "[ ]";
	const result = positionToString(position);
	return isHeld ? `-${showHeld ? result : ""}` : result;
}

/**
 * @param {*} sortKey
 * @returns an easily-readable representation of the sort code as degrees in a seven-note scale
 */
function sortKeyToString(sortKey, showHeld = false) {
	const result = [];
	for (let index = 0; index < sortKey.length; index++) {
		const char = sortKey[index];
		result.push(displayOneAsText(char, showHeld));
	}
	return result.join(" ");
}

module.exports = {
	positionToString,
	sortKeyToString,
};
