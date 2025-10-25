/**
 * ABC Music Toolkit
 * Main entry point for ABC parsing, manipulation, and sorting
 */

const parser = require("./parse/parser.js");
const manipulator = require("./manipulator.js");
const sort = require("./contour-sort.js");
const incipit = require("./incipit.js");
const javascriptify = require("./javascriptify.js");

module.exports = {
	// Parser functions
	...parser,

	// Manipulator functions
	...manipulator,

	// Sort functions
	...sort,

	// Incipit functions
	...incipit,

	//
	javascriptify,
};
