// ============================================================================
// CORE CONSTANTS
// ============================================================================

const baseChar = 0x0420; // middle of cyrillic
const silenceChar = "_"; // silence character

const OCTAVE_SHIFT = 7; // 7 scale degrees per octave
const abcBaseTwoOctaves = "CDEFGABcdefgab";

// ============================================================================
// ENCODING FUNCTIONS
// ============================================================================

/**
 * Calculate modal position and octave offset for a note
 * Returns a compact representation: octave * 7 + degree (both 0-indexed)
 */
function calculateModalPosition(tonalBase, pitch, octaveShift) {
	const relativeDegree =
		abcBaseTwoOctaves.indexOf(pitch) - abcBaseTwoOctaves.indexOf(tonalBase);

	// Return position as single number: octave * 7 + degree

	return octaveShift * OCTAVE_SHIFT + relativeDegree;
}

/**
 * Encode position and played/held status as a single character
 * This ensures held notes (even codes) compare before played notes (odd codes)
 *
 * @param {number} position - encodes the degree + octave
 * @param {boolean} isHeld - if the note is held or not
 * @returns the encoded modal degree information (MDI). Format: baseChar + (position * 2) + (isHeld ? 0 : 1)
 */
function encodeToChar(position, isHeld) {
	const code = baseChar + position * 2 + (isHeld ? 0 : 1);
	return String.fromCharCode(code);
}

/**
 * Decode a character back to position and held status
 */
function decodeChar(char) {
	if (char === silenceChar) {
		return { isSilence: true, position: null, isHeld: null };
	}

	const code = char.charCodeAt(0) - baseChar;
	const position = Math.floor(code / 2);
	const isHeld = code % 2 === 0;
	return { position, isHeld, isSilence: false };
}

function shiftChar(char, nbOctaves) {
	const { position, isHeld } = decodeChar(char);
	return encodeToChar(position + nbOctaves * OCTAVE_SHIFT, isHeld);
}

module.exports = {
	calculateModalPosition,
	encodeToChar,
	decodeChar,
	shiftChar,
	silenceChar
};
