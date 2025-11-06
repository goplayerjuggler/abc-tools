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
	{
		withSvg = false,
		withSwingTransform = false,
		maxNbBars = new Fraction(3, 2),
		maxNbUnitLengths = 12,
		svgConfig = {},
	} = {}
) {
	const tonalBase = getTonalBase(abc);

	const unitLength = getUnitLength(abc); //todo: could add as an argument; default null
	if (typeof maxNbBars === "number") maxNbBars = new Fraction(maxNbBars);
	let meter = getMeter(abc); //todo: could add as an argument; default null
	if (!meter) meter = [4, 4]; //temp
	const meterFraction = new Fraction(meter[0], meter[1]);
	if (maxNbUnitLengths) {
		const maxNbBarsFromMaxUnitLength = unitLength
			.multiply(maxNbUnitLengths)
			.divide(meterFraction);

		maxNbBars = Fraction.min(maxNbBarsFromMaxUnitLength, maxNbBars);
	}
	const maxDuration = maxNbBars * meterFraction;

	const {
		bars,
	} = //todo: could add as an argument; default null
		parseAbc(abc, {
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

	if (withSwingTransform) {
		swingTransform(notes, unitLength, meter);
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
			const { nbUnitLengths, remainingDuration } = divideDuration(
				duration,
				unitLength
			);

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

function divideDuration(duration, unitLength) {
	const ratio = duration.divide(unitLength);
	const nbUnitLengths = Math.floor(ratio.num / ratio.den);
	const remainingDuration = duration.subtract(
		unitLength.multiply(nbUnitLengths)
	);
	return { nbUnitLengths, remainingDuration };
}

function swingTransform(notes, unitLength, meter) {
	if (meter[0] % 2 !== 0) {
		throw new Error("invalid meter for swing transform");
	}
	// modify notes to ensure all are of duration <= 2*unitLength
	{
		const twoUnits = unitLength.multiply(2);
		let tooLong = notes
				.map((n, i) => {
					return { n, i };
				})
				.filter((n) => n.n.duration.compare(twoUnits) > 0),
			safety = 0;

		while (tooLong.length > 0) {
			if (safety > 1000) throw new Error("swingTransform safety check failed");

			const noteToSplit = tooLong[0].n;
			const { nbUnitLengths, remainingDuration } = divideDuration(
				noteToSplit.duration,
				twoUnits
			);
			noteToSplit.duration = twoUnits;
			if (!tooLong.isSilence) noteToSplit.tied = true;
			const toAdd = [];
			for (let i = 1; i < nbUnitLengths; i++) {
				toAdd.push({ ...noteToSplit });
			}
			const lastNote = { ...noteToSplit };
			lastNote.duration = remainingDuration;
			toAdd.push(lastNote);
			notes.splice(tooLong[0].i + 1, 0, ...toAdd);
			/*
    myArray.splice(index, 0, ...itemsToInsert): The splice method takes three arguments:
        The first argument (index) is the starting index at which to modify the array.
        The second argument (0) indicates that no elements should be removed from the array.
        The third argument uses the spread operator (...itemsToInsert) to insert the elements of itemsToInsert into myArray at the specified index.
 */
			safety++;
			tooLong = notes
				.map((n, i) => {
					return { n, i };
				})
				.filter((n) => n.n.duration.compare(twoUnits) > 0);
		}
	}

	const longPartOfBroken = unitLength.multiply(3).divide(2),
		shortPartOfBroken = unitLength.divide(2),
		triplet = unitLength.multiply(2).divide(3),
		multiplier = new Fraction(3, 2);

	let i = 0;
	while (true) {
		if (i >= notes.length) break;
		const n1 = notes[i],
			n2 = i + 1 < notes.length ? notes[i + 1] : null,
			n3 = i + 2 < notes.length ? notes[i + 2] : null;

		//basic: change AB to A2B
		if (
			n2 &&
			n1.duration.equals(unitLength) &&
			n2.duration.equals(unitLength)
		) {
			n1.duration = unitLength.multiply(2);
			i += 2;
			continue;
		}
		//broken
		if (
			n2 &&
			n1.duration.equals(longPartOfBroken) &&
			n2.duration.equals(shortPartOfBroken)
		) {
			n1.duration = unitLength.multiply(2);
			n2.duration = unitLength;
			i += 2;
			continue;
		}
		//reverse broken
		if (
			n2 &&
			n2.duration.equals(longPartOfBroken) &&
			n1.duration.equals(shortPartOfBroken)
		) {
			n2.duration = unitLength.multiply(2);
			n1.duration = unitLength;
			i += 2;
			continue;
		}

		//triplets
		if (
			n2 &&
			n3 &&
			n1.duration.equals(triplet) &&
			n2.duration.equals(triplet) &&
			n3.duration.equals(triplet)
		) {
			n1.duration = unitLength;
			n2.duration = unitLength;
			n3.duration = unitLength;
			i += 3;
			continue;
		}
		// other
		n1.duration = n1.duration.multiply(multiplier);
		i++;
	}
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
