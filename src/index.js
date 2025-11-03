/**
 * ABC Music Toolkit
 * Main entry point for ABC parsing, manipulation, and sorting
 */

const parser = require("./parse/parser.js");
const manipulator = require("./manipulator.js");
const sort = require("./sort/contour-sort.js");
const contourToSvg = require("./sort/contour-svg.js");
const displayContour = require("./sort/display-contour.js");

const incipit = require("./incipit.js");
const javascriptify = require("./javascriptify.js");
const { getContour } = require("./sort/get-contour.js");

module.exports = {
	// Parser functions
	...parser,

	// Manipulator functions
	...manipulator,

	// Sort functions
	...sort,
	...displayContour,
	...contourToSvg,
	getContour,

	// Incipit functions
	...incipit,

	//
	javascriptify,
};
