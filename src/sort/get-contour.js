const { Fraction } = require("../math.js");

const {
	calculateModalPosition,
	encodeToChar,
	silenceChar,
} = require("./encode.js");

const {
	getTonalBase,
	getUnitLength,
	parseAbc,
	getMeter,
} = require("../parse/parser.js");

const { contourToSvg } = require("./contour-svg.js");

// ============================================================================
// Contour (compare object) generation
// ============================================================================

/**
 * Generate contour (compare object) from ABC notation
 * @returns { sortKey: string, durations: Array, version: string, part: string }
 *
 * todo: complete this header. options.withSvg; options.maxNbUnitLengths
 */
function getContour(
	abc,
	{ withSvg = false, maxNbUnitLengths = 10, svgConfig = {} } = {}
) {
	const tonalBase = getTonalBase(abc);
	const unitLength = getUnitLength(abc);
	const maxDuration = unitLength.multiply(maxNbUnitLengths);
	const meter = getMeter(abc);
	const maxNbBars = meter
		? maxDuration.divide(new Fraction(meter[0], meter[1]))
		: new Fraction(2, 1); //default 2 bars when no meter (free meter)
	const { bars } = parseAbc(abc, {
		maxBars: Math.ceil(maxNbBars.toNumber()),
	});
	let cumulatedDuration = new Fraction(0, 1);
	const sortKey = [];
	const durations = [];
	// const debugPositions = [];
	let index = 0;
	// get the parsed notes - notes are tokens with a duration
	const notes = [];
	let tied = false,
		previousPosition = null;
	for (let i = 0; i < bars.length; i++) {
		const bar = bars[i];
		for (let j = 0; j < bar.length; j++) {
			const token = bar[j];
			if (token.duration && token.duration.num > 0) {
				cumulatedDuration = cumulatedDuration.add(token.duration);
				if (cumulatedDuration.isGreaterThan(maxDuration)) break;
				notes.push(token);
			}
		}
	}

	notes.forEach((note) => {
		const { duration, isSilence } = note;
		const comparison = duration.compare(unitLength);
		const { encoded, encodedHeld, position } = isSilence
			? { encoded: silenceChar, encodedHeld: silenceChar, position: 0 }
			: getEncodedFromNote(note, tonalBase, tied, previousPosition);

		if (note.tied) {
			tied = true;
			previousPosition = position;
		} else {
			tied = false;
			previousPosition = null;
		}

		if (comparison > 0) {
			// Held note: duration > unitLength
			const ratio = duration.divide(unitLength);
			const nbUnitLengths = Math.floor(ratio.num / ratio.den);
			const remainingDuration = duration.subtract(
				unitLength.multiply(nbUnitLengths)
			);

			// const durationRatio = Math.round(ratio.num / ratio.den);

			// First note is played
			sortKey.push(encoded);
			//debugPositions.push(position);

			// Subsequent notes are held
			for (let i = 1; i < nbUnitLengths; i++) {
				sortKey.push(encodedHeld);
				//debugPositions.push(position);
			}

			index += nbUnitLengths;
			if (remainingDuration.num !== 0) {
				pushShortNote(
					encodedHeld,
					unitLength,
					duration,
					index,
					durations,
					sortKey
				);
				//debugPositions.push(position);
				index++;
			}
		} else if (comparison < 0) {
			pushShortNote(encoded, unitLength, duration, index, durations, sortKey);
			//debugPositions.push(position);
			index++;
		} else {
			// Normal note: duration === unitLength
			sortKey.push(encoded);
			//debugPositions.push(position);
			index++;
		}
	});

	const result = {
		sortKey: sortKey.join(""),
		//debugPositions: debugPositions.join(","),
	};
	if (durations.length > 0) {
		result.durations = durations;
	}
	if (withSvg) {
		result.svg = contourToSvg(result, svgConfig);
	}
	return result;
}

/**
 * Adds a short note (duration < unitLength) to the contour
 * @param {string} encoded - the encoded representation of the note’s modal degree information (MDI)
 * @param {Fraction} unitLength - the unit length
 * @param {Fraction} duration - the duration of the note
 * @param {number} index - the index of the note
 * @param {Array<object>} durations - the durations array
 * @param {Array<string>} sortKey - array of MDIs
 */
function pushShortNote(
	encoded,
	unitLength,
	duration,
	index,
	durations,
	sortKey
) {
	const relativeDuration = duration.divide(unitLength),
		d = {
			i: index,
			d: relativeDuration.den,
		};
	if (relativeDuration.num !== 1) {
		d.n = relativeDuration.num;
	}

	durations.push(d);
	sortKey.push(encoded);
}

function getEncodedFromNote(note, tonalBase, tied, previousPosition) {
	// Handle pitched note
	const { pitch, octave } = note;
	const position = calculateModalPosition(tonalBase, pitch, octave);
	const encodedHeld = encodeToChar(position, true);
	const encoded = encodeToChar(position, false);

	return {
		encoded: tied && position === previousPosition ? encodedHeld : encoded,
		encodedHeld,
		position,
	};
}

module.exports = {
	getContour,
};
