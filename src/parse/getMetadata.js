const { normaliseKey } = require("../manipulator");
const { decodeABCText, stripComment } = require("./decode-abc-text");

/**
 * Extracts data in the ABC _header_ T R C M K S O F D N H fields
 * and returns it in an object with properties: title, rhythm, composer, meter, key,
 * source, origin, url, recording, comments, and hComments.
 * - Only the first T title is stored in `title`; subsequent ones go in `titles`
 * - The key is normalised: C, Cmaj, C maj, C major all map to "C major"
 * - N: lines accumulate in a `comments` array
 * - H: lines (and +: continuations) are joined with spaces into `hComments`
 * - ABC text escapes (mnemonics, entities, etc.) are decoded by default
 * @param {string} abc
 * @param {object}  [options]
 * @param {boolean} [options.decode=true] - Decode ABC text escapes; pass false for raw speed
 * @returns {object}
 */
function getMetadata(abc, { decode = true } = {}) {
	const lines = abc.split("\n"),
		metadata = {},
		comments = [],
		hComments = [],
		titles = [];

	const process = decode
		? (raw) => decodeABCText(stripComment(raw))
		: (raw) => stripComment(raw);

	let currentHeader = "";

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed[0] === "%") continue;

		if (trimmed.startsWith("K:")) {
			metadata.key = normaliseKey(
				stripComment(trimmed.substring(2).trim())
			).join(" ");
			break;
		}

		const val = process(trimmed.substring(2).trim());

		if (trimmed.startsWith("T:")) {
			if (!metadata.title) metadata.title = val;
			else titles.push(val);
		} else if (trimmed.startsWith("R:")) {
			metadata.rhythm = val.toLowerCase();
		} else if (trimmed.startsWith("C:")) {
			metadata.composer = val;
		} else if (trimmed.startsWith("M:")) {
			metadata.meter = val;
		} else if (trimmed.startsWith("S:")) {
			metadata.source = val;
		} else if (trimmed.startsWith("O:")) {
			metadata.origin = val;
		} else if (trimmed.startsWith("F:")) {
			metadata.url = val;
		} else if (trimmed.startsWith("D:")) {
			metadata.recording = val;
		} else if (trimmed.startsWith("N:")) {
			comments.push(val);
		} else if (trimmed.startsWith("H:")) {
			currentHeader = "H";
			hComments.push(val);
		} else if (trimmed.startsWith("+:") && currentHeader === "H") {
			hComments.push(val);
		}
	}

	if (comments.length > 0) metadata.comments = comments;
	if (hComments.length > 0) metadata.hComments = hComments.join(" ");
	if (titles.length > 0) metadata.titles = titles;

	return metadata;
}

module.exports = { getMetadata };
