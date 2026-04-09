const DEFAULT_METER_SORT_SPECS = [
	[
		{ meters: [[2], [4], [8]] },
		{
			meters: [
				[6, 2],
				[6, 4]
			],
			unitLengths: [
				[1, 8],
				[1, 16]
			]
		}
	],
	[{ meters: [[3]] }],
	[{ meters: [[6], [12]] }],
	[{ meters: [[9], [18]] }],
	[{ meters: [[5], [10]] }],
	[{ meters: [[7], [14]] }],
	[{ meters: [[11], [13]] }]
];

const DEFAULT_RHYTHM_GROUPS = [
	["jig", "slide", "single jig", "double jig"],
	["reel", "single reel", "reel (single)", "strathspey", "double reel"],
	["hornpipe", "barndance", "fling"]
];
const DEFAULT_NAME_PREFIXES = [
	"The ",
	"A ",
	"An ",
	/(?:(?:la )?(?:marche |bourrée |valse )|(?:le )?reel )(?:du |de la |de |à |des )?/i
];

const DEFAULT_CONTOUR_OPTIONS = {
	withSvg: true,
	swingTransform: ["hornpipe", "barndance", "fling", "mazurka"],
	incipitPart: "A"
};
const PREDEFINED_SORT_NAMES = [
	"rhythmContourName",
	"meterContourName",
	"nameContour"
];
const sortConstants = {
	DEFAULT_CONTOUR_OPTIONS,
	DEFAULT_METER_SORT_SPECS,
	DEFAULT_NAME_PREFIXES,
	DEFAULT_RHYTHM_GROUPS,
	PREDEFINED_SORT_NAMES
};
module.exports = { sortConstants };
