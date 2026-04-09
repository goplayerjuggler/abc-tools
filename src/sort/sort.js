const { compare, canBeCompared } = require("./contour-sort.js");
const { getContour } = require("./get-contour.js");
const { getIncipitForContourGeneration } = require("../incipit.js");
const { getMeter, getUnitLength } = require("../parse/parser.js");
const { sortConstants } = require("./sort-constants.js");

/// Returns the tune's meter as [n, d], or null. Uses cached _sortAbc.
function resolveMeter(tune) {
	if (!tune._sortMeter) {
		if (tune.meter !== undefined)
			tune._sortMeter =
				tune.meter instanceof String
					? tune.meter?.split("/")
					: Array.isArray(tune.meter) && tune.meter?.length
						? tune.meter
						: null;
		const abc = tune._sortAbc;
		if (!abc) tune._sortMeter = null;
		const m = getMeter(abc);
		tune._sortMeter = m?.length ? m : null;
	}
	return tune._sortMeter;
}

/// Returns the tune's unit length as a Fraction, or null. Uses cached _sortAbc.
function resolveUnitLength(tune) {
	if (tune.unitLength !== undefined) return tune.unitLength;
	try {
		return tune._sortAbc ? getUnitLength(tune._sortAbc) : null;
	} catch {
		return null;
	}
}
///Returns true if the given meter (and optionally unit length) satisfies one MeterSortSpec entry.
function meterMatchesSpec(meter, unitLength, spec) {
	if (!meter) return false;
	const [n, d] = meter;
	const meterMatches = spec.meters.some(
		([sn, sd]) => sn === n && (sd === undefined || sd === d)
	);
	if (!meterMatches) return false;
	if (!spec.unitLengths) return true;
	if (!unitLength) return false;
	return spec.unitLengths.some(
		([un, ud]) => unitLength.num === un && unitLength.den === ud
	);
}

///Returns the 0-based index of the first matching group, or meterSortSpecs.length for the fallback group.
function getMeterGroup(meter, unitLength, meterSortSpecs) {
	for (let i = 0; i < meterSortSpecs.length; i++) {
		if (
			meterSortSpecs[i].some((spec) =>
				meterMatchesSpec(meter, unitLength, spec)
			)
		)
			return i;
	}
	return meterSortSpecs.length;
}

/// Returns the ABC fragment used for contour / meter resolution.
function getAbc_default(tune) {
	return getIncipitForContourGeneration(
		tune.incipit
			? tune.incipit
			: Array.isArray(tune.abc)
				? tune.abc[0]
				: tune.abc
	);
}

function ensureContour(tune, contourOptions) {
	if (tune.contour) return;
	const {
		swingTransform = sortConstants.DEFAULT_CONTOUR_OPTIONS.swingTransform,
		incipitPart = "A",
		...getContourOpts
	} = contourOptions;

	if (incipitPart !== "A")
		throw new Error(`incipitPart "${incipitPart}" is not yet implemented`);

	try {
		const shortAbc = tune._sortAbc;
		if (!shortAbc) return;
		getContourOpts.withSwingTransform = swingTransform.includes(tune.rhythm);
		if (Object.hasOwn(tune, "contourShift"))
			getContourOpts.contourShift = tune.contourShift;
		tune.contour = getContour(shortAbc, getContourOpts);
	} catch (err) {
		console.error(err);
	}
}
function compareContour(a, b) {
	if (a.contour && b.contour && canBeCompared(a, b))
		return compare(a.contour, b.contour);
	if (a.contour) return -1;
	if (b.contour) return 1;
	return 0;
}

/**
 * Returns name with any matching prefix stripped, for comparison purposes only.
 * @param {string} name
 * @param {(string|RegExp)[]} prefixes
 */
function stripPrefix(name, prefixes) {
	if (!name) return "";
	for (const p of prefixes) {
		if (p instanceof RegExp) {
			const m = name.match(p);
			if (m && m.index === 0) {
				return name.slice(m[0].length);
			}
		} else {
			if (name.toLowerCase().startsWith(p.toLowerCase()))
				return name.slice(p.length);
		}
	}
	return name;
}

function annotateTunes(tunes, levels) {
	for (const level of levels) {
		switch (level.type) {
			case "rhythm": {
				const groups =
					level.rhythmGroups ?? sortConstants.DEFAULT_RHYTHM_GROUPS;
				const map = {};
				groups.forEach((g, i) => g.forEach((r) => (map[r] = `${i}_${g[0]}`)));
				tunes.forEach((t) => (t._sortRhythm = map[t.rhythm] ?? t.rhythm ?? ""));
				break;
			}

			case "meter": {
				const specs =
					level.meterSortSpecs ?? sortConstants.DEFAULT_METER_SORT_SPECS;
				const needsUnitLength = specs.some((g) => g.some((s) => s.unitLengths));
				tunes.forEach((t) => {
					const meter = resolveMeter(t);
					const ul = needsUnitLength ? resolveUnitLength(t) : null;
					t._sortMeterGroup = getMeterGroup(meter, ul, specs);
					console.log(`${t.name}|${t.meter}|${t._sortMeterGroup}`);
				});
				break;
			}

			case "origin":
				tunes.forEach((t) => {
					const raw = t.origin ?? null;
					t._sortOrigin = raw ? raw.split(";")[0].trim() : null;
				});
				break;

			case "name": {
				const prefixes =
					level.ignoreNamePrefixes ?? sortConstants.DEFAULT_NAME_PREFIXES;
				tunes.forEach((t) => {
					t._sortName = stripPrefix(t.name ?? "", prefixes);
				});
				break;
			}

			case "contour": {
				const opts =
					level.contourOptions ?? sortConstants.DEFAULT_CONTOUR_OPTIONS;
				tunes.forEach((t) => ensureContour(t, opts));
				break;
			}

			default:
				throw new Error(`Unknown sort level type: "${level.type}"`);
		}
	}
}

function makeLevelComparator(level) {
	const dir = level.order === "desc" ? -1 : 1;
	const collator =
		level.type === "name"
			? new Intl.Collator("en", { sensitivity: "base" })
			: null;
	switch (level.type) {
		case "rhythm":
			return (a, b) =>
				a._sortRhythm === b._sortRhythm
					? 0
					: dir * (a._sortRhythm < b._sortRhythm ? -1 : 1);
		case "meter":
			return (a, b) =>
				a._sortMeterGroup === b._sortMeterGroup
					? 0
					: dir * (a._sortMeterGroup < b._sortMeterGroup ? -1 : 1);
		case "origin":
			return (a, b) => {
				const [oa, ob] = [a._sortOrigin, b._sortOrigin];
				if (oa === ob) return 0;
				if (!oa) return 1;
				if (!ob) return -1;
				return dir * (oa < ob ? -1 : 1);
			};
		case "name":
			return (a, b) => {
				const [na, nb] = [a._sortName ?? "", b._sortName ?? ""];
				return dir * collator.compare(na, nb);
			};
		case "contour":
			return (a, b) => dir * compareContour(a, b);
		default:
			throw new Error(`Unknown sort level type: "${level.type}"`);
	}
}

function resolveLevels(options) {
	const {
		predefinedSort,
		sortLevels,
		contourOptions = sortConstants.DEFAULT_CONTOUR_OPTIONS
	} = options;
	if (predefinedSort && sortLevels)
		throw new Error("Cannot specify both predefinedSort and sortLevels");
	if (sortLevels) return sortLevels;

	const contourLevel = { type: "contour", contourOptions };
	const nameLevel = { type: "name" };

	switch (predefinedSort ?? "rhythmContourName") {
		case "rhythmContourName":
			return [{ type: "rhythm" }, contourLevel, nameLevel];
		case "meterContourName":
			return [{ type: "meter" }, contourLevel, nameLevel];
		case "nameContour":
			return [nameLevel, contourLevel];
		default:
			throw new Error(`Unknown predefinedSort: "${predefinedSort}"`);
	}
}

/**
 * @param {Object[]} tunes - Array of tune objects to sort in-place.
 * @param {Object}   [options]
 * @param {function(Object): string} [options.getAbc]
 *   Returns an ABC fragment for a tune, used for contour generation and for
 *   resolving meter / unit length when those fields are absent from the tune
 *   object. Called at most once per tune; result is cached during the sort.
 *   Defaults to incipit-based extraction.
 * @param {string}   [options.predefinedSort="rhythmContourName"]
 *   Name of a predefined sort. One of "rhythmContourName", "meterContourName",
 *   "nameContour". Mutually exclusive with `sortLevels`.
 * @param {Object[]} [options.sortLevels]
 *   Explicit sort-level descriptors. Mutually exclusive with `predefinedSort`.
 *   Each entry has the shape { type, order?, ...levelOptions } where type is
 *   one of "rhythm" | "meter" | "origin" | "name" | "contour".
 * @param {Object}   [options.contourOptions]
 *   Options forwarded to getContour(). Applied to all contour levels in
 *   predefined sorts; for custom sortLevels, set contourOptions per level.
 *   Shape: { withSvg?, swingTransform?, incipitPart?, ...getContourPassthrough }
 */
function sort(tunes, options = {}) {
	const { getAbc = getAbc_default } = options;
	const levels = resolveLevels(options);
	const comparators = levels.map(makeLevelComparator);

	tunes.forEach((t) => (t._sortAbc = getAbc(t)));
	annotateTunes(tunes, levels);

	tunes.sort((a, b) => {
		for (const cmp of comparators) {
			const r = cmp(a, b);
			if (r !== 0) return r;
		}
		return 0;
	});

	const annotationKeys = [
		"_sortAbc",
		"_sortRhythm",
		"_sortMeterGroup",
		"_sortOrigin",
		"_sortName",
		"_sortMeter"
	];
	tunes.forEach((t) => annotationKeys.forEach((k) => delete t[k]));
}

module.exports = { sort };
