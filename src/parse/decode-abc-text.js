/**
 * Maps 2-char ABC mnemonic sequences (ABC 2.1 §2.3) to Unicode characters.
 * Keys are the two characters following the backslash.
 */
const MNEMONIC_MAP = {
	// Grave: \`X
	"`A": "À",
	"`a": "à",
	"`E": "È",
	"`e": "è",
	"`I": "Ì",
	"`i": "ì",
	"`O": "Ò",
	"`o": "ò",
	"`U": "Ù",
	"`u": "ù",
	// Acute: \'X
	"'A": "Á",
	"'a": "á",
	"'E": "É",
	"'e": "é",
	"'I": "Í",
	"'i": "í",
	"'O": "Ó",
	"'o": "ó",
	"'U": "Ú",
	"'u": "ú",
	"'Y": "Ý",
	"'y": "ý",
	// Circumflex: \^X
	"^A": "Â",
	"^a": "â",
	"^E": "Ê",
	"^e": "ê",
	"^I": "Î",
	"^i": "î",
	"^O": "Ô",
	"^o": "ô",
	"^U": "Û",
	"^u": "û",
	// Tilde: \~X
	"~A": "Ã",
	"~a": "ã",
	"~N": "Ñ",
	"~n": "ñ",
	"~O": "Õ",
	"~o": "õ",
	// Umlaut: \"X
	'"A': "Ä",
	'"a': "ä",
	'"E': "Ë",
	'"e': "ë",
	'"I': "Ï",
	'"i': "ï",
	'"O': "Ö",
	'"o': "ö",
	'"U': "Ü",
	'"u': "ü",
	'"Y': "Ÿ",
	'"y': "ÿ",
	// Cedilla, ring, slash
	cC: "Ç",
	cc: "ç",
	AA: "Å",
	aa: "å",
	"/O": "Ø",
	"/o": "ø",
	// Breve: \uX  (note: \uXXXX hex escapes are resolved before this map is applied)
	uA: "Ă",
	ua: "ă",
	uE: "Ĕ",
	ue: "ĕ",
	// Caron, double acute
	vS: "Š",
	vs: "š",
	vZ: "Ž",
	vz: "ž",
	HO: "Ő",
	Ho: "ő",
	HU: "Ű",
	Hu: "ű",
	// Ligatures
	ss: "ß",
	AE: "Æ",
	ae: "æ",
	oe: "œ"
};

/** Named HTML entities for common European characters. */
const HTML_ENTITY_MAP = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: "\u00A0",
	Agrave: "À",
	agrave: "à",
	Aacute: "Á",
	aacute: "á",
	Acirc: "Â",
	acirc: "â",
	Atilde: "Ã",
	atilde: "ã",
	Auml: "Ä",
	auml: "ä",
	Aring: "Å",
	aring: "å",
	AElig: "Æ",
	aelig: "æ",
	Ccedil: "Ç",
	ccedil: "ç",
	Egrave: "È",
	egrave: "è",
	Eacute: "É",
	eacute: "é",
	Ecirc: "Ê",
	ecirc: "ê",
	Euml: "Ë",
	euml: "ë",
	Igrave: "Ì",
	igrave: "ì",
	Iacute: "Í",
	iacute: "í",
	Icirc: "Î",
	icirc: "î",
	Iuml: "Ï",
	iuml: "ï",
	Ntilde: "Ñ",
	ntilde: "ñ",
	Ograve: "Ò",
	ograve: "ò",
	Oacute: "Ó",
	oacute: "ó",
	Ocirc: "Ô",
	ocirc: "ô",
	Otilde: "Õ",
	otilde: "õ",
	Ouml: "Ö",
	ouml: "ö",
	Oslash: "Ø",
	oslash: "ø",
	Ugrave: "Ù",
	ugrave: "ù",
	Uacute: "Ú",
	uacute: "ú",
	Ucirc: "Û",
	ucirc: "û",
	Uuml: "Ü",
	uuml: "ü",
	Yacute: "Ý",
	yacute: "ý",
	Yuml: "Ÿ",
	szlig: "ß",
	OElig: "Œ",
	oelig: "œ"
};

/**
 * Strips an ABC inline % comment (a % not preceded by \) and trims trailing whitespace.
 * @param {string} str
 * @returns {string}
 */
function stripComment(str) {
	return str.replace(/(?<!\\)%.*/, "").trimEnd();
}

/**
 * Decodes ABC 2.1 text-string escapes (§2.3) into Unicode.
 * Processing order:
 *   1. Protect \\ with a placeholder
 *   2. \uXXXX fixed-width unicode (must precede breve \uX mnemonic)
 *   3. Protect \% and \& control escapes
 *   4–6. HTML named / decimal / hex entities
 *   7. Curly-brace mnemonic variants: {mnem} or {\mnem}
 *   8. Backslash mnemonics: \XX
 *   9. Restore placeholders
 * @param {string} str - Header value, already comment-stripped
 * @returns {string}
 */
function decodeABCText(str) {
	return str
		.replace(/\\\\/g, "\x00")
		.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
			String.fromCodePoint(parseInt(h, 16))
		)
		.replace(/\\%/g, "\x01")
		.replace(/\\&/g, "\x02")
		.replace(/&([a-zA-Z]+);/g, (m, n) => HTML_ENTITY_MAP[n] ?? m)
		.replace(/&#x([0-9a-fA-F]+);/gi, (_, h) =>
			String.fromCodePoint(parseInt(h, 16))
		)
		.replace(/&#([0-9]+);/g, (_, n) => String.fromCodePoint(+n))
		.replace(/\{\\?([^}{]{2})\}/g, (m, k) => MNEMONIC_MAP[k] ?? m)
		.replace(/\\(..)/g, (m, k) => MNEMONIC_MAP[k] ?? m)
		.replaceAll("\u0000", "\\")
		.replaceAll("\u0001", "%")
		.replaceAll("\u0002", "&");
}

module.exports = { decodeABCText, stripComment };
