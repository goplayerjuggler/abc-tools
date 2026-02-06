/**
 * Analyze whitespace and back quotes after a token
 * Returns object describing the spacing/beaming context
 * Back quotes (`) are ignored for beaming but preserved for reconstruction
 *
 * @param {string} segment - The music segment to analyze
 * @param {number} tokenEndPos - Position where the token ends
 * @returns {object} - Spacing analysis object
 *
 * Return object structure:
 * {
 *   whitespace: string,     // Actual whitespace characters (back quotes removed)
 *   backquotes: number,     // Number of ` characters for reconstruction
 *   beamBreak: boolean,     // True if beam should break (multiple spaces/newline)
 *   lineBreak: boolean      // True if there was a newline after this token
 * }
 */
function analyzeSpacing(segment, tokenEndPos) {
	if (tokenEndPos >= segment.length) {
		return {
			whitespace: "",
			backquotes: 0,
			beamBreak: false,
			lineBreak: false
		};
	}

	const remaining = segment.substring(tokenEndPos);

	// Match whitespace and/or back quotes
	const spacingMatch = remaining.match(/^([\s`]+)/);

	if (!spacingMatch) {
		return {
			whitespace: "",
			backquotes: 0,
			beamBreak: false,
			lineBreak: false
		};
	}

	const fullSpacing = spacingMatch[1];

	// Count back quotes
	const backquotes = (fullSpacing.match(/`/g) || []).length;

	// Extract just whitespace (no back quotes)
	const whitespace = fullSpacing.replace(/`/g, "");

	return {
		whitespace,
		backquotes,
		beamBreak: whitespace.length > 1 || whitespace.includes("\n"), // Multiple spaces or newline breaks beam
		lineBreak: whitespace.includes("\n")
	};
}

/**
 * Parse tuplet notation from a token
 *
 * @param {string} token - Tuplet token (e.g., '(3', '(3:2', '(3:2:4')
 * @param {boolean} isCompoundTimeSignature - Whether current time signature is compound (affects default q value)
 * @returns {object|null} - { isTuple: true, p, q, r } or null if not a valid tuplet
 */
function parseTuplet(token, isCompoundTimeSignature) {
	const tupleMatch = token.match(/^\(([2-9])(?::(\d)?)?(?::(\d)?)?$/);
	if (tupleMatch) {
		const pqr = {
			p: parseInt(tupleMatch[1]),
			q: tupleMatch[2],
			r: tupleMatch[3]
		};
		const { p } = pqr;
		let { q, r } = pqr;
		if (q) {
			q = parseInt(q);
		} else {
			switch (p) {
				case 2:
					q = 3;
					break;
				case 3:
					q = 2;
					break;
				case 4:
					q = 3;
					break;
				case 5:
				case 7:
				case 9:
					q = isCompoundTimeSignature ? 3 : 2;
					break;
				case 6:
					q = 2;
					break;
				case 8:
					q = 3;
					break;
			}
		}
		if (r) {
			r = parseInt(r);
		} else {
			r = p;
		}
		return {
			isTuple: true,
			p,
			q,
			r
		};
	}
	return null;
}
module.exports = {
	analyzeSpacing,
	parseTuplet
};
