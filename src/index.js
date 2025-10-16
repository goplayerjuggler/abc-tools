/**
 * ABC Music Toolkit
 * Main entry point for ABC parsing, manipulation, and sorting
 */

const parser = require('./abc-parser.js');
const manipulator = require('./abc-manipulator.js');
const sort = require('./contour-sort.js');

module.exports = {
  // Parser functions
  ...parser,

  // Manipulator functions
  ...manipulator,

  // Sort functions
  ...sort
};
