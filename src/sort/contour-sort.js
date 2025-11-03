const { Fraction } = require("../math.js");

const {
	calculateModalPosition,
	decodeChar,
	encodeToChar,
	silenceChar,
} = require("./encode.js");

/**
 * Tune Contour Sort - Modal melody sorting algorithm
 * Sorts tunes by their modal contour, independent of key and mode
 */

// ============================================================================
// COMPARISON FUNCTIONS
// ============================================================================

/**
 * Compare two compare objects using expansion algorithm
 */
function compare(objA, objB) {
	let keyA = objA.sortKey;
	let keyB = objB.sortKey;

	const dursA = objA.durations || [];
	const dursB = objB.durations || [];

	// No durations: simple lexicographic comparison
	if (dursA.length === 0 && dursB.length === 0) {
		return keyA === keyB ? 0 : keyA < keyB ? -1 : 1;
	}

	// Build maps of position -> {n, d}
	const durMapA = Object.fromEntries(
		dursA.map((dur) => [dur.i, { n: dur.n || 1, d: dur.d }])
	);
	const durMapB = Object.fromEntries(
		dursB.map((dur) => [dur.i, { n: dur.n || 1, d: dur.d }])
	);

	let posA = 0;
	let posB = 0;
	let logicalIndex = 0;
	let counter = 0;

	while (posA < keyA.length && posB < keyB.length) {
		if (counter++ > 10000) {
			throw new Error("Sort algorithm iteration limit exceeded");
		}

		const durA = durMapA[logicalIndex];
		const durB = durMapB[logicalIndex];

		// Get durations as fractions
		const fracA = durA ? new Fraction(durA.n, durA.d) : new Fraction(1, 1);
		const fracB = durB ? new Fraction(durB.n, durB.d) : new Fraction(1, 1);

		const comp = fracA.compare(fracB);

		if (comp === 0) {
			// Same duration, compare characters directly
			const charA = keyA.charAt(posA);
			const charB = keyB.charAt(posB);

			if (charA < charB) {
				return -1;
			}
			if (charA > charB) {
				return 1;
			}

			posA++;
			posB++;
			logicalIndex++;
		} else if (comp < 0) {
			// fracA < fracB: expand B by inserting held note
			const charA = keyA.charAt(posA);
			const charB = keyB.charAt(posB);

			if (charA < charB) {
				return -1;
			}
			if (charA > charB) {
				return 1;
			}

			// Insert held note into B
			const decodedB = decodeChar(charB);
			const heldChar = decodedB.isSilence
				? silenceChar
				: encodeToChar(decodedB.position, true);

			keyB = keyB.substring(0, posB + 1) + heldChar + keyB.substring(posB + 1);

			// Update duration map for B
			const remainingDur = fracB.subtract(fracA);
			delete durMapB[logicalIndex];

			// Add new duration entry for the held note
			durMapB[logicalIndex + 1] = { n: remainingDur.num, d: remainingDur.den };

			// Shift all subsequent B durations by 1
			const newDurMapB = {};
			for (const idx in durMapB) {
				const numIdx = parseInt(idx);
				if (numIdx > logicalIndex + 1) {
					newDurMapB[numIdx + 1] = durMapB[idx];
				} else {
					newDurMapB[numIdx] = durMapB[idx];
				}
			}
			Object.assign(durMapB, newDurMapB);

			posA++;
			posB++;
			logicalIndex++;
		} else {
			// fracA > fracB: expand A by inserting held note
			const charA = keyA.charAt(posA);
			const charB = keyB.charAt(posB);

			if (charA < charB) {
				return -1;
			}
			if (charA > charB) {
				return 1;
			}

			// Insert held note into A
			const decodedA = decodeChar(charA);
			const heldChar = decodedA.isSilence
				? silenceChar
				: encodeToChar(decodedA.position, true);

			keyA = keyA.substring(0, posA + 1) + heldChar + keyA.substring(posA + 1);

			// Update duration map for A
			const remainingDur = fracA.subtract(fracB);
			delete durMapA[logicalIndex];

			durMapA[logicalIndex + 1] = { n: remainingDur.num, d: remainingDur.den };

			// Shift all subsequent A durations by 1
			const newDurMapA = {};
			for (const idx in durMapA) {
				const numIdx = parseInt(idx);
				if (numIdx > logicalIndex + 1) {
					newDurMapA[numIdx + 1] = durMapA[idx];
				} else {
					newDurMapA[numIdx] = durMapA[idx];
				}
			}
			Object.assign(durMapA, newDurMapA);

			posA++;
			posB++;
			logicalIndex++;
		}
	}

	if (posA >= keyA.length && posB >= keyB.length) {
		return 0;
	}
	return posA >= keyA.length ? -1 : 1;
}

/**
 * Sort an array of objects containing ABC notation
 */
function sortArray(arr) {
	for (const item of arr) {
		if (!item.contour && item.abc) {
			try {
				item.contour = getContour(item.abc);
			} catch (err) {
				console.error(`Failed to generate compare object: ${err.message}`);
				item.contour = null;
			}
		}
	}

	arr.sort((a, b) => {
		if (!a.contour && !b.contour) {
			return 0;
		}
		if (!a.contour) {
			return 1;
		}
		if (!b.contour) {
			return -1;
		}
		return compare(a.contour, b.contour);
	});

	return arr;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
	compare,
	sortArray,
	decodeChar,
};
