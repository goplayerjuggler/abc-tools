const { normaliseKey } = require("../manipulator");

/**
 * Extracts data in the ABC _header_ T R C M K S F D N H fields
 * and returns it in a object with properties: title, rhythm, composer, meter, key,
 * source, url, recording, comments, and hComments.
 * Minimal parsing, but a few features:
 * - only extracts the first T title; subsequent T entries are ignored
 * - the key is normalised, so C, Cmaj, C maj, C major will all map to key:"C major"
 * - the comments (i.e. the N / notes) go in an array called `comments`, with one array entry per N: line
 * - the history (H) lines are joined up with spaces into a single line that is returned as `hComments`
 * - the field continuation `+:` is handled only for lines following an initial H (history)
 * - if there’s more than one T (title), then titles after the first one are returned in an array `titles`
 * @param {*} abc
 * @returns {object} - The header info
 */
function getMetadata(abc) {
	const lines = abc.split("\n"),
		metadata = {},
		comments = [],
		hComments = [],
		titles = [];

	let currentHeader = "";

	for (const line of lines) {
		const trimmed = line.trim();
		const trimmed2 = trimmed.substring(2).trim().replace(/%.+/, "");
		if (trimmed.startsWith("T:")) {
			if (!metadata.title) metadata.title = trimmed2;
			else titles.push(trimmed2);
		} else if (trimmed.startsWith("R:")) {
			metadata.rhythm = trimmed2.toLowerCase();
		} else if (trimmed.startsWith("C:")) {
			metadata.composer = trimmed2;
		} else if (trimmed.startsWith("M:")) {
			metadata.meter = trimmed2;
		} else if (trimmed.startsWith("K:")) {
			metadata.key = normaliseKey(trimmed2).join(" ");
			// metadata.indexOfKey = i
			break;
		} else if (trimmed.startsWith("S:")) {
			metadata.source = trimmed2;
		} else if (trimmed.startsWith("O:")) {
			metadata.origin = trimmed2;
		} else if (trimmed.startsWith("F:")) {
			metadata.url = trimmed2;
		} else if (trimmed.startsWith("D:")) {
			metadata.recording = trimmed2;
		} else if (trimmed.startsWith("N:")) {
			comments.push(trimmed2);
		} else if (trimmed.startsWith("H:")) {
			currentHeader = "H";
			hComments.push(trimmed2);
		} else if (trimmed.startsWith("+:")) {
			switch (currentHeader) {
				case "H":
					hComments.push(trimmed2);
					break;
			}
		}
	}
	if (comments.length > 0) {
		metadata.comments = comments;
	}
	if (hComments.length > 0) {
		metadata.hComments = hComments.join(" ");
	}
	if (titles.length > 0) metadata.titles = titles;

	return metadata;
}

module.exports = { getMetadata };
