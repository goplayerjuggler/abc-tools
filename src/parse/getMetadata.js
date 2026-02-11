const { normaliseKey } = require("../manipulator");

/**
 * Extracts data in the ABC header T R C M K S F D N fields
 * and returns it in a object with properties: title, rhythm, composer, meter, key,
 * source, url, recording, and comments.
 * Minimal parsing, but a few features:
 * - only extracts the first T title; subsequent T entries are ignored
 * - the key is normalised, so C, Cmaj, C maj, C major will all map to key:"C major"
 * - the comments go in an array, with one array entry per N: line.
 * @param {*} abc
 * @returns {object} - The header info
 */
function getMetadata(abc) {
	const lines = abc.split("\n"),
		metadata = {},
		comments = [],
		hComments = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith("T:") && !metadata.title) {
			metadata.title = trimmed.substring(2).trim();
		} else if (trimmed.startsWith("R:")) {
			metadata.rhythm = trimmed.substring(2).trim().toLowerCase();
		} else if (trimmed.startsWith("C:")) {
			metadata.composer = trimmed.substring(2).trim();
		} else if (trimmed.startsWith("M:")) {
			metadata.meter = trimmed.substring(2).trim();
		} else if (trimmed.startsWith("K:")) {
			metadata.key = normaliseKey(trimmed.substring(2).trim()).join(" ");
			// metadata.indexOfKey = i
			break;
		} else if (trimmed.startsWith("S:")) {
			metadata.source = trimmed.substring(2).trim();
		} else if (trimmed.startsWith("O:")) {
			metadata.origin = trimmed.substring(2).trim();
		} else if (trimmed.startsWith("F:")) {
			metadata.url = trimmed.substring(2).trim();
		} else if (trimmed.startsWith("D:")) {
			metadata.recording = trimmed.substring(2).trim();
		} else if (trimmed.startsWith("N:")) {
			comments.push(trimmed.substring(2).trim());
		} else if (trimmed.startsWith("H:")) {
			hComments.push(trimmed.substring(2).trim());
		}
	}
	if (comments.length > 0) {
		metadata.comments = comments;
	}
	if (hComments.length > 0) {
		metadata.hComments = hComments.join(" ");
	}

	return metadata;
}

module.exports = { getMetadata };
