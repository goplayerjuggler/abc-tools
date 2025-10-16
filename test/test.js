const { getSortObject, sort, sortArray, decodeChar } = require('../src/index.js');
const {Fraction, gcd, lcm} = require('../src/math.js');
// ============================================================================
// UNIT TESTS
// ============================================================================

function runTests() {
  console.log('Running sort tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  function assert(condition, message) {
	if (condition) {
	  console.log(`✓ ${message}`);
	  passed++;
	} else {
	  console.error(`✗ ${message}`);
	  failed++;
	}
  }
  
  // Test 1: Basic encoding - G major held note
  console.log('Test 1: basic encoding - G major held note');
  const abc1 = `X:1
T: Test 1
R: jig
L:1/8
M:12/8
K:G major
G2B`;
  
  const obj1 = getSortObject(abc1);
  const decoded1 = Array.from(obj1.sortKey).map(c => decodeChar(c));
  assert(decoded1[0].isHeld === false && decoded1[1].isHeld === true, 
	'G2 encoded as played then held');
  assert(decoded1[0].position === decoded1[1].position, 
	'Both G notes at same position');
  console.log(`  Sort key length: ${obj1.sortKey.length}\n`);
  
  // Test 2: Held vs repeated notes
  console.log('Test 2: held vs repeated notes');
  const abcHeld = `X:1\nL:1/8\nK:C\nC2`;
  const abcRepeated = `X:1\nL:1/8\nK:C\nCC`;
  
  const objHeld = getSortObject(abcHeld);
  const objRepeated = getSortObject(abcRepeated);
  
  const decodedHeld = Array.from(objHeld.sortKey).map(c => decodeChar(c));
  const decodedRep = Array.from(objRepeated.sortKey).map(c => decodeChar(c));
  
  assert(decodedHeld[1].isHeld === true, 'C2 second note is held');
  assert(decodedRep[1].isHeld === false, 'CC second note is played');
  assert(sort(objHeld, objRepeated) === -1, 'Held note sorts before repeated note');
  console.log(`  Held: ${objHeld.sortKey.length} chars, Repeated: ${objRepeated.sortKey.length} chars\n`);
  
  // Test 3: Subdivisions
  console.log('Test 3a: subdivisions');
  const abcSub = `X:1\nL:1/8\nK:C\nC/D/E`;
  const objSub = getSortObject(abcSub);
  
  assert(objSub.sortKey.length === 3, 'C/D/E has 3 notes');
  assert(objSub.durations && objSub.durations.length === 2, 
	'Two subdivisions recorded');
  assert(objSub.durations[0].d === 2, 'First subdivision has divisor 2');
  console.log(`  Durations: ${JSON.stringify(objSub.durations)}\n`);
  
  console.log('Test 3b: triplet subdivisions');
  const abcSub2 = `X:1\nL:1/8\nK:C\n(3CDEF`;
  const objSub2 = getSortObject(abcSub2);
  
  assert(objSub2.sortKey.length === 4, '(3CDEF has 4 notes');
  assert(objSub2.durations && objSub2.durations.length === 3, 
	'3 subdivisions recorded');
  assert(objSub2.durations && objSub2.durations[0].d === 3, 'First subdivision has divisor 3');
  console.log(`  Durations: ${JSON.stringify(objSub2.durations)}\n`);
  
  // Test 4: Octave shifts
  console.log('Test 4: octave shifts');
  const abcOctaves = `X:1\nL:1/8\nK:C\nC, C c c'`;
  const objOctaves = getSortObject(abcOctaves);
  
  const decodedOct = Array.from(objOctaves.sortKey).map(c => decodeChar(c));
  assert(decodedOct[0].position < decodedOct[1].position, 'C, lower than C');
  assert(decodedOct[1].position < decodedOct[2].position, 'C lower than c');
  assert(decodedOct[2].position < decodedOct[3].position, "c lower than c'");
  console.log(`  Positions: ${decodedOct.map(d => d.position).join(', ')}\n`);
  
  // Test 5: The Munster
  console.log('Test 5: the munster');
  const abcMunster = `X:1
T: The Munster
R: jig
L:1/8
M:12/8
K:G major
G2B AGA B2d gdB`;
  
  const objMunster = getSortObject(abcMunster);
  assert(objMunster.sortKey.length === 12, 'The Munster has 12 encoded notes');
  console.log(`  Sort key length: ${objMunster.sortKey.length}\n`);
  
  // Test 6: Different keys, same contour
  console.log('Test 6: different keys, same contour');
  const abcG = `X:1\nL:1/8\nK:G\nGAB`;
  const abcD = `X:1\nL:1/8\nK:D\nDEF`;
  
  const objG = getSortObject(abcG);
  const objD = getSortObject(abcD);
  
  assert(objG.sortKey === objD.sortKey, 
	'Same modal contour in different keys produces same sort key');
  console.log(`  Both keys produce identical sort keys\n`);
  
  // Test 7: Array sorting
  console.log('Test 7: array sorting');
  const tunes = [
	{ name: 'Tune 1', abc: 'X:1\nL:1/8\nK:C\nccc' },
	{ name: 'Tune 2', abc: 'X:1\nL:1/8\nK:C\nCCC' },
	{ name: 'Tune 3', abc: 'X:1\nL:1/8\nK:C\nCDE' }
  ];
  
  sortArray(tunes);
  
  assert(tunes[0].name === 'Tune 2', 'CCC sorts first');
  assert(tunes[1].name === 'Tune 3', 'CDE sorts second');
  assert(tunes[2].name === 'Tune 1', 'ccc sorts last');
  console.log(`  Order: ${tunes.map(t => t.name).join(', ')}\n`);

  // Test 8: The Flogging vs The Colliers (with triplets)
  console.log('Test 8: the flogging vs the colliers; including triplets');
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
T: The Colliers
R: reel
L:1/8
M:4/2
K:D mixo
FDE/F/G A2AB cAdB cAG2 |` 
  };
  
  const theColliers2 = { 
	name: 'The Colliers (triplet)', 
	abc: `X:1
T: The Colliers
R: reel
L:1/8
M:4/2
K:D mixo
FD(3EFG A2AB cAdB cAG2 |` 
  };
  
  const tunes2 = [theFlogging, theColliers];
  const tunes3 = [theColliers, theFlogging];
  const tunes4 = [theColliers2, theColliers, theFlogging];
  
  sortArray(tunes2);
  assert(tunes2[0].name === 'The Flogging', 'The Flogging sorts first (original order)');
  assert(tunes2[1].name === 'The Colliers', 'The Colliers sorts second');
  console.log(`  Order: ${tunes2.map(t => t.name).join(', ')}\n`);
  
  sortArray(tunes3);
  assert(tunes3[0].name === 'The Flogging', 'The Flogging sorts first (reversed order)');
  assert(tunes3[1].name === 'The Colliers', 'The Colliers sorts second');
  
  console.log('Sorting 3 tunes with triplet variation');
  sortArray(tunes4);
  assert(tunes4[0].name === 'The Flogging', 'The Flogging sorts first');
  assert(tunes4[1].name === 'The Colliers (triplet)', 'The Colliers (triplet) sorts second');
  assert(tunes4[2].name === 'The Colliers', 'The Colliers sorts third');
  console.log(`  Order: ${tunes4.map(t => t.name).join(', ')}\n`);
  
  // Test 9: Triplet vs sixteenth notes
  console.log('Test 9: triplet vs sixteenth notes comparison');
  const abcTriplet = `X:1\nL:1/8\nK:C\n(3CDE F`;
  const abcSixteenth = `X:1\nL:1/8\nK:C\nC/D/E F`;
  
  const objTriplet = getSortObject(abcTriplet);
  const objSixteenth = getSortObject(abcSixteenth);
  
  assert(objTriplet.durations[0].d === 3, 'Triplet has divisor 3');
  assert(objSixteenth.durations[0].d === 2, 'Sixteenth has divisor 2');
  
  const comparison = sort(objTriplet, objSixteenth);
  console.log(`  Triplet vs Sixteenth comparison result: ${comparison}`);
  console.log(`  (Negative means triplet sorts first, positive means sixteenth sorts first)\n`);
  
  // Test 10: Silences
  console.log('Test 10: silences');
  const abcSilence = `X:1\nL:1/8\nK:C\nCzD`;
  const objSilence = getSortObject(abcSilence);
  
  const decodedSilence = Array.from(objSilence.sortKey).map(c => decodeChar(c));
  assert(decodedSilence[1].isSilence === true, 'Middle character is silence');
  assert(decodedSilence[0].isSilence === false, 'First character is not silence');
  assert(decodedSilence[2].isSilence === false, 'Third character is not silence');
  console.log(`  Silence encoding works correctly\n`);
  
  // Test 11: Silence sorts before notes
  console.log('Test 11: silence sorts before notes');
  const abcSilenceFirst = `X:1\nL:1/8\nK:C\nzC`;
  const abcNoteFirst = `X:1\nL:1/8\nK:C\nCC`;
  
  const objSilenceFirst = getSortObject(abcSilenceFirst);
  const objNoteFirst = getSortObject(abcNoteFirst);
  
  assert(sort(objSilenceFirst, objNoteFirst) === -1, 'Silence sorts before note');
  console.log(`  Silence sorting works correctly\n`);
  
  // Test 12: Long silence
  console.log('Test 12: long silence');
  const abcLongSilence = `X:1\nL:1/8\nK:C\nz2C`;
  const objLongSilence = getSortObject(abcLongSilence);
  
  const decodedLongSilence = Array.from(objLongSilence.sortKey).map(c => decodeChar(c));
  assert(decodedLongSilence.length === 3, 'z2 creates 2 silence characters');
  assert(decodedLongSilence[0].isSilence === true, 'First is silence');
  assert(decodedLongSilence[1].isSilence === true, 'Second is silence');
  assert(decodedLongSilence[2].isSilence === false, 'Third is note');
  console.log(`  Long silence encoding works correctly\n`);
  
  // Test 13: Short silence
  console.log('Test 13: short silence');
  const abcShortSilence = `X:1\nL:1/8\nK:C\nz/C`;
  const objShortSilence = getSortObject(abcShortSilence);
  
  assert(objShortSilence.durations && objShortSilence.durations.length === 1, 
	'Short silence creates duration entry');
  assert(objShortSilence.durations[0].d === 2, 'Short silence has divisor 2');
  console.log(`  Short silence encoding works correctly\n`);
  
  // Summary
  console.log('='.repeat(50));
  console.log(`Tests completed: ${passed} passed, ${failed} failed`);
  
  return failed === 0;
}

// Run tests if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}