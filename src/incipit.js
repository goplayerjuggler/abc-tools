"use strict";
const { Fraction } = require("./math.js");
const { getFirstBars } = require("./manipulator.js");

const { getUnitLength, getMeter } = require("./parse/parser.js");
const { getContour } = require("./sort/get-contour.js");

//this file has code that's a fork of some code in  Michael Eskin's abctools

//
// Clean an incipit line
//
function cleanIncipitLine(theTextIncipit) {
	//console.log("Starting incipit:");
	//console.log(theTextIncipit);

	// Strip any embedded voice [V:*]
	let searchRegExp = /\[V:\s*\d+\]/gm;
	theTextIncipit = theTextIncipit.replace(searchRegExp, "");
	//console.log(theTextIncipit);

	// Strip any embedded voice V: *
	//searchRegExp = /V: [^ ]+ /gm
	searchRegExp = /V:\s+\S+\s/gm;
	theTextIncipit = theTextIncipit.replace(searchRegExp, "");
	//console.log(theTextIncipit);

	// Strip any embedded voice V:*
	searchRegExp = /V:[^ ]+ /gm;
	theTextIncipit = theTextIncipit.replace(searchRegExp, "");
	//console.log(theTextIncipit);

	// Sanitize !*! style annotations, but keep !fermata!
	searchRegExp = /!(?!fermata!)[^!\n]*!/gm;
	theTextIncipit = theTextIncipit.replace(searchRegExp, "");
	//console.log(theTextIncipit);

	// Strip out repeat marks
	theTextIncipit = theTextIncipit.replaceAll("|:", "|");
	theTextIncipit = theTextIncipit.replaceAll(":|", "|");

	// strip out 1st 2nd etc time repeats
	searchRegExp = /\[\d(,\d)*/gm;
	theTextIncipit = theTextIncipit.replace(searchRegExp, "");

	//console.log(theTextIncipit);

	// Strip out brackets
	//   theTextIncipit = theTextIncipit.replaceAll("[", "");
	//console.log(theTextIncipit);

	// Strip out brackets
	//   theTextIncipit = theTextIncipit.replaceAll("]", "");
	//console.log(theTextIncipit);

	// keep continuations!
	// theTextIncipit = theTextIncipit.replaceAll("\\", "");

	// Segno
	theTextIncipit = theTextIncipit.replaceAll("S", "");

	// Strip out comments
	theTextIncipit = theTextIncipit.replace(/"[^"]+"/gm, "");
	// Strip out inline parts
	theTextIncipit = theTextIncipit.replace(/\[P:[Ⅰ\w]\]/gm, "");

	//
	theTextIncipit = theTextIncipit.replace(/^\|[:|]?/, "");
	return theTextIncipit;
}

function StripAnnotationsOneForIncipits(theNotes) {
	// Strip out tempo markings
	let searchRegExp = /^Q:.*[\r\n]*/gm;

	// Strip out tempo markings
	theNotes = theNotes.replace(searchRegExp, "");

	// Strip out Z: annotation
	searchRegExp = /^Z:.*[\r\n]*/gm;

	// Strip out Z: annotation
	theNotes = theNotes.replace(searchRegExp, "");

	// Strip out R: annotation
	searchRegExp = /^R:.*[\r\n]*/gm;

	// Strip out R: annotation
	theNotes = theNotes.replace(searchRegExp, "");

	// Strip out S: annotation
	searchRegExp = /^S:.*[\r\n]*/gm;

	// Strip out S: annotation
	theNotes = theNotes.replace(searchRegExp, "");

	// Strip out N: annotation
	searchRegExp = /^N:.*[\r\n]*/gm;

	// Strip out N: annotation
	theNotes = theNotes.replace(searchRegExp, "");

	// Strip out D: annotation
	searchRegExp = /^D:.*[\r\n]*/gm;

	// Strip out D: annotation
	theNotes = theNotes.replace(searchRegExp, "");

	// Strip out H: annotation
	searchRegExp = /^H:.*[\r\n]*/gm;

	// Strip out H: annotation
	theNotes = theNotes.replace(searchRegExp, "");

	// Strip out B: annotation
	searchRegExp = /^B:.*[\r\n]*/gm;

	// Strip out B: annotation
	theNotes = theNotes.replace(searchRegExp, "");

	// Strip out C: annotation
	searchRegExp = /^C:.*[\r\n]*/gm;

	// Strip out C: annotation
	theNotes = theNotes.replace(searchRegExp, "");

	// Strip out O: annotation
	searchRegExp = /^O:.*[\r\n]*/gm;

	// Strip out O: annotation
	theNotes = theNotes.replace(searchRegExp, "");

	// Strip out A: annotation
	searchRegExp = /^A:.*[\r\n]*/gm;

	// Strip out A: annotation
	theNotes = theNotes.replace(searchRegExp, "");

	// Strip out P: annotation
	searchRegExp = /^P:.*[\r\n]*/gm;

	// Strip out P: annotation
	theNotes = theNotes.replace(searchRegExp, "");

	return theNotes;
}

//
// Strip all the text annotations in the ABC
//
function StripTextAnnotationsOne(theNotes) {
	// Strip out text markings
	let searchRegExp = /%%text .*[\r\n]*/gm;

	theNotes = theNotes.replace(searchRegExp, "");

	searchRegExp = /%%text[\r\n]/gm;

	theNotes = theNotes.replace(searchRegExp, "");

	// Strip out %%center annotation
	searchRegExp = /%%center.*[\r\n]*/gm;

	// Strip out %%center annotation
	theNotes = theNotes.replace(searchRegExp, "");

	// Strip out %%right annotation
	searchRegExp = /%%right.*[\r\n]*/gm;

	// Strip out %%right annotation
	theNotes = theNotes.replace(searchRegExp, "");

	// Strip out %%begintext / %%endtext blocks
	theNotes = theNotes.replace(/^%%begintext[\s\S]*?^%%endtext.*(\r?\n)?/gm, "");

	return theNotes;
}

//
// Strip all the chords in the ABC
//
function StripChordsOne(theNotes) {
	function match_callback(match) {
		// Don't strip tab annotations, only chords
		if (match.indexOf('"_') === -1 && match.indexOf('"^') === -1) {
			// Try and avoid stripping long text strings that aren't chords
			if (match.length > 9) {
				return match;
			}
			// If there are spaces in the match, also probably not a chord
			else if (match.indexOf(" ") !== -1) {
				return match;
			} else {
				return "";
			}
		} else {
			return match;
		}
	}

	// Strip out chord markings and not text annotations
	const searchRegExp = /"[^"]*"/gm;

	const output = theNotes
		.split("\n")
		.map((line) => {
			// If line starts with one of the forbidden prefixes, skip replacement
			if (/^[XTMKLQWZRCAOPNGHBDFSIV]:/.test(line) || /^%/.test(line)) {
				return line;
			} else {
				return line.replace(searchRegExp, match_callback);
			}
		})
		.join("\n");

	// Replace the ABC
	return output;
}

function sanitise(theTune) {
	let j, k;
	const theTextIncipits = [];
	// Strip out annotations
	theTune = StripAnnotationsOneForIncipits(theTune);

	// Strip out atextnnotations
	theTune = StripTextAnnotationsOne(theTune);

	// Strip out chord markings
	theTune = StripChordsOne(theTune);

	// Parse out the first few measures
	const theLines = theTune.split("\n"),
		nLines = theLines.length;

	// Find the key
	let theKey = "";
	let indexOfTheKey;

	for (j = 0; j < nLines; ++j) {
		theKey = theLines[j];

		if (theKey.indexOf("K:") !== -1) {
			indexOfTheKey = j;
			break;
		}
	}

	const unitLength = getUnitLength(theTune);
	const meter = getMeter(theTune),
		theM = meter ? `${meter[0]}/${meter[1]}` : "none";

	// Use at most the first three lines following the header K:
	let added = 0;
	for (k = indexOfTheKey + 1; k < nLines; ++k) {
		const theTextIncipit = theLines[k];
		if (theTextIncipit.match(/^\s*%%/)) continue; // skip lines starting with %%
		// Clean out the incipit line of any annotations besides notes and bar lines
		theTextIncipits.push(cleanIncipitLine(theTextIncipit));
		added++;

		if (added === 3) break;
	}

	return `X:1\nM:${theM}\nL:1/${
		unitLength.den
	}\n${theKey}\n${theTextIncipits.join("\n")}`;
}

/**
 * Get incipit (opening bars) of a tune for display/search purposes
 * @param {object|string} Object of the form {abc} with optional property: numBars, or a string in ABC format
 * @param {string} params.abc - ABC notation
 * @param {number|Fraction} params.numBars - Number of bars to return, counting the anacrucis if there is one.
 * (default: 1.5 for some cases like M:4/4 L:1/16; 3 for M:3/4; otherwise 2)
 * @returns {string} - ABC incipit
 */
function getIncipit(data) {
	let {
		abc,
		numBars, //, part=null
	} = typeof data === "string" ? { abc: data } : data;

	const { withAnacrucis = true } =
		typeof data === "string" ? { abc: data } : data;

	if (!numBars) {
		numBars = 2;
		const currentMeter = getMeter(abc);
		const unitLength = getUnitLength(abc);
		if (
			(currentMeter[0] === 4 &&
				currentMeter[1] === 4 &&
				unitLength.den === 16) ||
			(currentMeter[0] === 4 &&
				currentMeter[1] === 2 &&
				unitLength.den === 8) ||
			(currentMeter[0] === 12 && currentMeter[1] === 8)
		) {
			numBars = new Fraction(3, 2);
		} else if (currentMeter[0] === 3 && currentMeter[1] === 4) {
			numBars = 3;
		}
	}
	abc = sanitise(abc);
	return getFirstBars(abc, numBars, withAnacrucis, false, { all: true });
}

function getIncipitForContourGeneration(
	abc,
	{ numBars = new Fraction(2, 1) } = {}
) {
	return getIncipit({
		abc,
		withAnacrucis: false,
		numBars,
	});
}

function getContourFromFullAbc(
	abc,
	{
		withSvg = true,
		withSwingTransform = false,
		numBars = new Fraction(3, 2),
	} = {}
) {
	if (Array.isArray(abc)) {
		if (abc.length === 0) return null;
		abc = abc[0];
	}
	return getContour(getIncipitForContourGeneration(abc, { numBars }), {
		withSvg,
		withSwingTransform,
	});
}

module.exports = {
	getIncipit,
	getIncipitForContourGeneration,
	getContourFromFullAbc,
};
