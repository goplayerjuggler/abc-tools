const parser = require("./parse/parser.js");
const miscParser = require("./parse/misc-parser.js");
const manipulator = require("./manipulator.js");
const sort = require("./sort/sort.js");
const sortConstants = require("./sort/sort-constants.js");
const { compare } = require("./sort/contour-sort.js");
const contourToSvg = require("./sort/contour-svg.js");
const displayContour = require("./sort/display-contour.js");

const incipit = require("./incipit.js");
const javascriptify = require("./javascriptify.js");
const getContour = require("./sort/get-contour.js");
const math = require("./math.js");
const { getBarInfo } = require("./parse/getBarInfo.js");
const { getMetadata } = require("./parse/getMetadata.js");

module.exports = {
	// Get info
	...parser,
	...miscParser,
	getBarInfo,
	getMetadata,
	...incipit,

	// change things
	...manipulator,

	// Sort
	...sort,
	...sortConstants,
	compareContour: compare,
	...displayContour,
	...contourToSvg,
	...getContour,

	// other
	javascriptify,
	...math
};
