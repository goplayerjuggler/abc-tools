const { getSortObject, sort, sortArray, decodeChar } = require('../src/index.js');

describe('ABC Tools - Sorting', () => {
  describe('Basic encoding', () => {
    test('G major held note', () => {
      const abc1 = `X:1
T: Test 1
R: jig
L:1/8
M:12/8
K:G major
G2B`;

      const obj1 = getSortObject(abc1);
      const decoded1 = Array.from(obj1.sortKey).map(c => decodeChar(c));

      expect(decoded1[0].isHeld).toBe(false);
      expect(decoded1[1].isHeld).toBe(true);
      expect(decoded1[0].position).toBe(decoded1[1].position);
      expect(obj1.sortKey.length).toBeGreaterThan(0);
    });
  });

  describe('Held vs repeated notes', () => {
    test('held note vs repeated note', () => {
      const abcHeld = 'X:1\nL:1/8\nK:C\nC2';
      const abcRepeated = 'X:1\nL:1/8\nK:C\nCC';

      const objHeld = getSortObject(abcHeld);
      const objRepeated = getSortObject(abcRepeated);

      const decodedHeld = Array.from(objHeld.sortKey).map(c => decodeChar(c));
      const decodedRep = Array.from(objRepeated.sortKey).map(c => decodeChar(c));

      expect(decodedHeld[1].isHeld).toBe(true);
      expect(decodedRep[1].isHeld).toBe(false);
      expect(sort(objHeld, objRepeated)).toBe(-1);
    });
  });

  describe('Durations', () => {
    test('subdivision durations', () => {
      const abcSub = 'X:1\nL:1/8\nK:C\nC/D/E';
      const objSub = getSortObject(abcSub);

      expect(objSub.sortKey.length).toBe(3);
      expect(objSub.durations).toBeDefined();
      expect(objSub.durations.length).toBe(2);
      expect(objSub.durations[0].d).toBe(2);
    });

    test('triplet durations', () => {
      const abcSub2 = 'X:1\nL:1/8\nK:C\n(3CDEF';
      const objSub2 = getSortObject(abcSub2);

      expect(objSub2.sortKey.length).toBe(4);
      expect(objSub2.durations).toBeDefined();
      expect(objSub2.durations.length).toBe(3);
      expect(objSub2.durations[0].d).toBe(3);
    });

    test('triplet vs sixteenth notes comparison', () => {
      const abcTriplet = 'X:1\nL:1/8\nK:C\n(3CDE F';
      const abcSixteenth = 'X:1\nL:1/8\nK:C\nC/D/E F';

      const objTriplet = getSortObject(abcTriplet);
      const objSixteenth = getSortObject(abcSixteenth);

      expect(objTriplet.durations[0].d).toBe(3);
      expect(objSixteenth.durations[0].d).toBe(2);

      const comparison = sort(objTriplet, objSixteenth);
      expect(typeof comparison).toBe('number');
    });

    test('semiquavers as CSB', () => {
      const theColliers14 = {
        name: 'The Colliers',
        abc: `X:1
T: The Colliers
R: reel
L: 1/8
M:4/4
K:D mixo
FDE/F/G A2AB cAdB cAG2 |`
      };
      const objSub14 = getSortObject(theColliers14.abc);

      expect(objSub14.sortKey.length).toBe(17);
      expect(objSub14.durations).toBeDefined();
      expect(objSub14.durations.length).toBe(2);
      expect(objSub14.durations[0].d).toBe(2);
    });
  });

  describe('Octave shifts', () => {
    test('different octaves sort correctly', () => {
      const abcOctaves = "X:1\nL:1/8\nK:C\nC, C c c'";
      const objOctaves = getSortObject(abcOctaves);

      const decodedOct = Array.from(objOctaves.sortKey).map(c => decodeChar(c));

      expect(decodedOct[0].position).toBeLessThan(decodedOct[1].position);
      expect(decodedOct[1].position).toBeLessThan(decodedOct[2].position);
      expect(decodedOct[2].position).toBeLessThan(decodedOct[3].position);
    });
  });

  describe('Complex tunes', () => {
    test('The Munster', () => {
      const abcMunster = `X:1
T: The Munster
R: jig
L:1/8
M:12/8
K:G major
G2B AGA B2d gdB`;

      const objMunster = getSortObject(abcMunster);
      expect(objMunster.sortKey.length).toBe(12);
    });
  });

  describe('Different keys, same contour', () => {
    test('same modal contour produces same sort key', () => {
      const abcG = 'X:1\nL:1/8\nK:G\nGAB';
      const abcD = 'X:1\nL:1/8\nK:D\nDEF';

      const objG = getSortObject(abcG);
      const objD = getSortObject(abcD);

      expect(objG.sortKey).toBe(objD.sortKey);
    });
  });

  describe('Array sorting', () => {
    test('sorts array correctly', () => {
      const tunes = [
        { name: 'Tune 1', abc: 'X:1\nL:1/8\nK:C\nccc' },
        { name: 'Tune 2', abc: 'X:1\nL:1/8\nK:C\nCCC' },
        { name: 'Tune 3', abc: 'X:1\nL:1/8\nK:C\nCDE' }
      ];

      sortArray(tunes);

      expect(tunes[0].name).toBe('Tune 2');
      expect(tunes[1].name).toBe('Tune 3');
      expect(tunes[2].name).toBe('Tune 1');
    });
  });

  describe('The Flogging vs The Colliers', () => {
    const theFlogging = {
      name: 'The Flogging',
      abc: `X: 12
T: The Flogging
R: reel
M: 4/2
L: 1/8
K: Gmaj
BGGA BGdG BGGA Bdgd|`
    };

    const theColliers = {
      name: 'The Colliers',
      abc: `X:1
T: The Colliers'
R: reel
L:1/8
M:4/2
K:D mixo
FDE/F/G A2AB cAdB cAG2 |`
    };

    const theColliers2 = {
      name: 'The Colliers (triplet)',
      abc: `X:1
T: The Colliers'
R: reel
L:1/8
M:4/2
K:D mixo
FD(3EFG A2AB cAdB cAG2 |`
    };

    test('sorts two tunes correctly (original order)', () => {
      const tunes = [theFlogging, theColliers];
      sortArray(tunes);

      expect(tunes[0].name).toBe('The Flogging');
      expect(tunes[1].name).toBe('The Colliers');
    });

    test('sorts two tunes correctly (reversed order)', () => {
      const tunes = [theColliers, theFlogging];
      sortArray(tunes);

      expect(tunes[0].name).toBe('The Flogging');
      expect(tunes[1].name).toBe('The Colliers');
    });

    test('sorts three tunes with triplet variation', () => {
      const tunes = [theColliers2, theColliers, theFlogging];
      sortArray(tunes);

      expect(tunes[0].name).toBe('The Flogging');
      expect(tunes[1].name).toBe('The Colliers (triplet)');
      expect(tunes[2].name).toBe('The Colliers');
    });

    test('same tune with different CSB sorts together', () => {
      const theColliers14 = {
        name: 'The Colliers',
        abc: `X:1
T: The Colliers
R: reel
L: 1/16
M:4/4
K:D mixo
FDE/F/G A2AB cAdB cAG2 |`//L:1/16
      };

      const objSub14 = getSortObject(theColliers14.abc);
      expect(sort(objSub14, theColliers.sortObject)).toBe(0);
    });
  });

  describe('Silences', () => {
    test('encodes silence correctly', () => {
      const abcSilence = 'X:1\nL:1/8\nK:C\nCzD';
      const objSilence = getSortObject(abcSilence);

      const decodedSilence = Array.from(objSilence.sortKey).map(c => decodeChar(c));

      expect(decodedSilence[1].isSilence).toBe(true);
      expect(decodedSilence[0].isSilence).toBe(false);
      expect(decodedSilence[2].isSilence).toBe(false);
    });

    test('silence sorts before notes', () => {
      const abcSilenceFirst = 'X:1\nL:1/8\nK:C\nzC';
      const abcNoteFirst = 'X:1\nL:1/8\nK:C\nCC';

      const objSilenceFirst = getSortObject(abcSilenceFirst);
      const objNoteFirst = getSortObject(abcNoteFirst);

      expect(sort(objSilenceFirst, objNoteFirst)).toBe(-1);
    });

    test('long silence', () => {
      const abcLongSilence = 'X:1\nL:1/8\nK:C\nz2C';
      const objLongSilence = getSortObject(abcLongSilence);

      const decodedLongSilence = Array.from(objLongSilence.sortKey).map(c => decodeChar(c));

      expect(decodedLongSilence.length).toBe(3);
      expect(decodedLongSilence[0].isSilence).toBe(true);
      expect(decodedLongSilence[1].isSilence).toBe(true);
      expect(decodedLongSilence[2].isSilence).toBe(false);
    });

    test('short silence', () => {
      const abcShortSilence = 'X:1\nL:1/8\nK:C\nz/C';
      const objShortSilence = getSortObject(abcShortSilence);

      expect(objShortSilence.durations).toBeDefined();
      expect(objShortSilence.durations.length).toBe(1);
      expect(objShortSilence.durations[0].d).toBe(2);
    });
  });
});
