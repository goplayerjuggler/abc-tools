/**
 * Tune Contour Sort - Modal melody sorting algorithm
 * Sorts tunes by their modal contour, independent of key and mode
 * @version 1.0.0
 */

// ============================================================================
// CORE ENCODING TABLES
// ============================================================================

/**
 * Encoding table for ABC notes to hex values (played notes)
 * Format: tonal base -> ABC note -> hex value
 */
const ENCODING_TABLE = {
  'A': { 'C': 0x55, 'D': 0x57, 'E': 0x59, 'F': 0x5B, 'G': 0x5D, 'A': 0x5E, 'B': 0x60, 'c': 0x62 },
  'B': { 'C': 0x53, 'D': 0x55, 'E': 0x57, 'F': 0x59, 'G': 0x5B, 'A': 0x5D, 'B': 0x5E, 'c': 0x60 },
  'C': { 'C': 0x51, 'D': 0x53, 'E': 0x55, 'F': 0x57, 'G': 0x59, 'A': 0x5B, 'B': 0x5D, 'c': 0x5E },
  'D': { 'C': 0x4F, 'D': 0x51, 'E': 0x53, 'F': 0x55, 'G': 0x57, 'A': 0x59, 'B': 0x5B, 'c': 0x5D },
  'E': { 'C': 0x4D, 'D': 0x4F, 'E': 0x51, 'F': 0x53, 'G': 0x55, 'A': 0x57, 'B': 0x59, 'c': 0x5B },
  'F': { 'C': 0x4B, 'D': 0x4D, 'E': 0x4F, 'F': 0x51, 'G': 0x53, 'A': 0x55, 'B': 0x57, 'c': 0x59 },
  'G': { 'C': 0x49, 'D': 0x4B, 'E': 0x4D, 'F': 0x4F, 'G': 0x51, 'A': 0x53, 'B': 0x55, 'c': 0x57 }
};

const OCTAVE_SHIFT = 0x0E; // 14 in decimal

// ============================================================================
// ABC PARSING UTILITIES
// ============================================================================

/**
 * Extract key signature from ABC header
 * @param {string} abc - ABC notation string
 * @returns {string} Tonal base (e.g., 'G', 'D', 'A')
 */
function extractTonalBase(abc) {
  //const keyMatch = abc.match(/^K:\s*([A-G])[#b]?/m);
  const keyMatch = abc.match(/^K:\s*([A-G])/m);
  if (!keyMatch) {
    throw new Error('No key signature found in ABC');
  }
  return keyMatch[1].toUpperCase();
}

/**
 * Extract unit note length from ABC header
 * @param {string} abc - ABC notation string
 * @returns {number} Unit length as fraction (e.g., 0.125 for 1/8)
 */
function extractUnitLength(abc) {
  const lengthMatch = abc.match(/^L:\s*(\d+)\/(\d+)/m);
  if (lengthMatch) {
    return parseInt(lengthMatch[1]) / parseInt(lengthMatch[2]);
  }
  // Default to 1/8 if not specified
  return 0.125;
}

/**
 * Parse ABC note to extract pitch, octave, and duration
 * @param {string} noteStr - ABC note string (e.g., 'G2', 'c/', 'B')
 * @returns {Object} { pitch, octave, duration }
 */
function parseNote(noteStr, unitLength) {
  // Handle rests
  if (noteStr.match(/^[zx]/i)) {
    return null;
  }

  // Extract pitch (letter)
  const pitchMatch = noteStr.match(/[A-Ga-g]/);
  if (!pitchMatch) return null;
  
  const pitch = pitchMatch[0];
  
  // Count octave modifiers
  const upOctaves = (noteStr.match(/'/g) || []).length;
  const downOctaves = (noteStr.match(/,/g) || []).length;
  const octave = upOctaves - downOctaves;
  
  // Parse duration
  let duration = unitLength;
  
  // Handle explicit multipliers (e.g., '2', '3')
  const multMatch = noteStr.match(/(\d+)(?![\/])/);
  if (multMatch) {
    duration *= parseInt(multMatch[1]);
  }
  
  // Handle divisions (e.g., '/', '//', '///')
  const divMatch = noteStr.match(/\/+/);
  if (divMatch) {
    const slashes = divMatch[0].length;
    duration /= Math.pow(2, slashes);
  }
  
  // Handle explicit fractions (e.g., '3/2')
  const fracMatch = noteStr.match(/(\d+)\/(\d+)/);
  if (fracMatch) {
    duration = unitLength * parseInt(fracMatch[1]) / parseInt(fracMatch[2]);
  }
  
  return { pitch, octave, duration };
}

/**
 * Tokenize ABC music notation into individual notes
 * @param {string} abc - ABC notation string
 * @returns {Array<string>} Array of note tokens
 */
function tokenizeABC(abc) {
  // Extract the music lines (after headers)
  const lines = abc.split('\n');
  let musicLines = [];
  let inHeaders = true;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('%')) continue;
    
    // Check if still in headers
    if (inHeaders && trimmed.match(/^[A-Z]:/)) {
      continue;
    }
    inHeaders = false;
    musicLines.push(trimmed);
  }
  
  const music = musicLines.join(' ');
  
  // Tokenize: match notes with their modifiers
  // Pattern: [=^_]?[A-Ga-g][',]*[0-9]*[\/]*[0-9]*
  const tokens = music.match(/[=^_]?[A-Ga-g][',]*[0-9]*\/?[0-9]*/g) || [];
  
  return tokens;
}

// ============================================================================
// ENCODING FUNCTIONS
// ============================================================================

/**
 * Get the base encoding for a note in the primary octave
 * @param {string} tonalBase - Key's tonal base
 * @param {string} pitch - ABC pitch character
 * @returns {number} Base hex encoding
 */
function getBaseEncoding(tonalBase, pitch) {
  // Normalize pitch to uppercase for lookup
  const upperPitch = pitch.toUpperCase();
  
  if (!ENCODING_TABLE[tonalBase] || !(upperPitch in ENCODING_TABLE[tonalBase])) {
    throw new Error(`Cannot encode pitch ${pitch} in key ${tonalBase}`);
  }
  
  let encoding = ENCODING_TABLE[tonalBase][upperPitch];
  
  // Adjust for lowercase (one octave up)
  if (pitch === pitch.toLowerCase()) {
    encoding += OCTAVE_SHIFT;
  }
  
  return encoding;
}

/**
 * Encode a single note with octave adjustments
 * @param {number} baseEncoding - Base encoding from table
 * @param {number} octaveShift - Octave shift from apostrophes/commas
 * @param {boolean} isHeld - Whether note is held (not played)
 * @returns {number} Final encoding
 */
function encodeNote(baseEncoding, octaveShift, isHeld) {
  let encoding = baseEncoding + (octaveShift * OCTAVE_SHIFT);
  if (isHeld) {
    encoding -= 1;
  }
  return encoding;
}

// ============================================================================
// SORT OBJECT GENERATION
// ============================================================================

/**
 * Generate sort object from ABC notation
 * @param {string} abc - ABC notation string
 * @param {Object} options - { nbBars: number, part: string }
 * @returns {Object} { sortKey, rhythmicDivisions, version, part }
 */
function getSortObject(abc, options = {}) {
  const { nbBars = Infinity, part = 'A' } = options;
  
  const tonalBase = extractTonalBase(abc);
  const unitLength = extractUnitLength(abc);
  const tokens = tokenizeABC(abc);
  
  const sortKey = [];
  const rhythmicDivisions = [];
  
  let barCount = 0;
  let previousDuration = null;
  let index = 0;
  
  for (const token of tokens) {
    // Stop if we've processed enough bars
    if (token === '|' || token === '||' || token === '|]') {
      barCount++;
      if (barCount >= nbBars) break;
      continue;
    }
    
    const note = parseNote(token, unitLength);
    if (!note) continue;
    
    const { pitch, octave, duration } = note;
    const baseEncoding = getBaseEncoding(tonalBase, pitch);
    
    // Determine if this is a held note (duration > unitLength)
    if (duration > unitLength) {
      // Held note: encode as played then held
      const durationRatio = Math.round(duration / unitLength);
      
      // First note is played
      const playedEncoding = encodeNote(baseEncoding, octave, false);
      sortKey.push(playedEncoding.toString(16).padStart(2, '0'));
      
      // Subsequent notes are held
      for (let i = 1; i < durationRatio; i++) {
        const heldEncoding = encodeNote(baseEncoding, octave, true);
        sortKey.push(heldEncoding.toString(16).padStart(2, '0'));
      }
      
      index += durationRatio;
    } else if (duration < unitLength) {
      // Subdivided note: record the division
      const divisor = Math.round(unitLength / duration);
      rhythmicDivisions.push({ index, divisor });
      
      const playedEncoding = encodeNote(baseEncoding, octave, false);
      sortKey.push(playedEncoding.toString(16).padStart(2, '0'));
      
      index++;
    } else {
      // Normal note (duration === unitLength)
      const playedEncoding = encodeNote(baseEncoding, octave, false);
      sortKey.push(playedEncoding.toString(16).padStart(2, '0'));
      
      index++;
    }
    
    previousDuration = duration;
  }
  
  return {
    sortKey: sortKey.join(''),
    rhythmicDivisions: rhythmicDivisions.length > 0 ? rhythmicDivisions : undefined,
    version: '1.0',
    part
  };
}

// ============================================================================
// COMPARISON FUNCTIONS
// ============================================================================

/**
 * Expand a sort key at a given position with held notes
 * @param {string} sortKey - Hex string sort key
 * @param {number} position - Character position (must be even)
 * @param {number} expansionFactor - How many times to repeat
 * @returns {string} Expanded sort key
 */
function expandSortKey(sortKey, position, expansionFactor) {
  const before = sortKey.substring(0, position);
  const noteHex = sortKey.substring(position, position + 2);
  const after = sortKey.substring(position + 2);
  
  // First occurrence is the note itself
  const expansions = [noteHex];
  
  // Subsequent occurrences are held notes (subtract 1)
  const noteValue = parseInt(noteHex, 16);
  const heldValue = noteValue - 1;
  const heldHex = heldValue.toString(16).padStart(2, '0');
  
  for (let i = 1; i < expansionFactor; i++) {
    expansions.push(heldHex);
  }
  //if(expansionFactor > 1) console.log(JSON.stringify({before,expansions,after}))//debug
  return before + expansions.join('') + after;
}

/**
 * Find least common multiple
 */
function lcm(a, b) {
  return Math.abs(a * b) / gcd(a, b);
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Compare two sort objects
 * @param {Object} objA - First sort object
 * @param {Object} objB - Second sort object
 * @returns {number} -1 if A < B, 0 if equal, 1 if A > B
 */
function sort(objA, objB) {
  let keyA = objA.sortKey;
  let keyB = objB.sortKey;
  
  const divsA = objA.rhythmicDivisions || [];
  const divsB = objB.rhythmicDivisions || [];

  //no divisions: simple sort by key
  if (divsA.length == 0 && divsB.length == 0) {
	return keyA === keyB ? 0 : (keyA<keyB ? -1 : 1)
  }
  //try sorting up to the first division
  while(true)
	{
		let firstDivision = -1
		if (divsA.length > 0) {
		  firstDivision = divsA[0].index
		}
		if(firstDivision === 0) break
		
		if (divsB.length > 0 && divsB[0].index < firstDivision) {
		  firstDivision = divsB[0].index
		}
		if(firstDivision === 0) break
		const substA = keyA.substr(0,firstDivision)
		const substB = keyB.substr(0,firstDivision)
		if (substA < substB) {
			return -1
		} else if (substA > substB) {
			return 1
		} else break
	}

  // Build maps of position -> divisor
  let divMapA = {};
  let divMapB = {};
  
  for (const div of divsA) {
    divMapA[div.index] = div.divisor;
  }
  for (const div of divsB) {
    divMapB[div.index] = div.divisor;
  }
  //console.log(JSON.stringify({divMapA, divMapB}))
  
  // Compare position by position (2 chars at a time)
  let posA = 0;
  let posB = 0;
  let logicalIndex = 0;
  let counter=0
  while (posA < keyA.length && posB < keyB.length) {
	if (counter > 1000) {
		throw new Error("sort algorithm is taking too long");
	}
    const divA = divMapA[logicalIndex] || 1;
    const divB = divMapB[logicalIndex] || 1;
    
    if (divA === divB) {
      // Same duration, compare directly
      const hexA = keyA.substring(posA, posA + 2);
      const hexB = keyB.substring(posB, posB + 2);
      
      if (hexA < hexB) return -1;
      if (hexA > hexB) return 1;
      
      posA += 2;
      posB += 2;
      logicalIndex++;
    } else {
      // Different durations, need to expand
      const factor = lcm(divA, divB);
      const expandA = factor / divA;
      const expandB = factor / divB;
      


      // Expand both keys at current position
      keyA = expandSortKey(keyA, posA, expandA);
      keyB = expandSortKey(keyB, posB, expandB);
      
      // Update division maps (shift all subsequent indices)
      const newDivMapA = {};
      const newDivMapB = {};
      
      for (const idx in divMapA) {
        const numIdx = parseInt(idx);
        if (numIdx > logicalIndex) {
          newDivMapA[numIdx + expandA - 1] = divMapA[idx];
        } else if (numIdx === logicalIndex) {
          // This division has been expanded, remove it
        } else {
          newDivMapA[numIdx] = divMapA[idx];
        }
      }
      
      for (const idx in divMapB) {
        const numIdx = parseInt(idx);
        if (numIdx > logicalIndex) {
          newDivMapB[numIdx + expandB - 1] = divMapB[idx];
        } else if (numIdx === logicalIndex) {
          // This division has been expanded, remove it
        } else {
          newDivMapB[numIdx] = divMapB[idx];
        }
      }
      
    //   Object.assign(divMapA, newDivMapA);
    //   Object.assign(divMapB, newDivMapB);
     divMapA = newDivMapA
	 divMapB = newDivMapB
      // Don't increment logical index yet, compare the expanded sections first
    }
	counter++
  }
  
  // If we've exhausted both keys, they're equal
  if (posA >= keyA.length && posB >= keyB.length) return 0;
  
  // Otherwise, shorter one comes first
  return posA >= keyA.length ? -1 : 1;
}

/**
 * Sort an array of objects containing ABC notation
 * @param {Array<Object>} arr - Array of objects with 'abc' property
 * @returns {Array<Object>} Sorted array (mutates original)
 */
function sortArray(arr) {
  // Generate sort objects for items that don't have them
  for (const item of arr) {
    if (!item.sortObject && item.abc) {
      try {
        item.sortObject = getSortObject(item.abc);
      } catch (err) {
        console.error(`Failed to generate sort object: ${err.message}`);
        item.sortObject = null;
      }
    }
  }
  
  // Sort using the comparison function
  arr.sort((a, b) => {
    if (!a.sortObject && !b.sortObject) return 0;
    if (!a.sortObject) return 1;
    if (!b.sortObject) return -1;
    return sort(a.sortObject, b.sortObject);
  });
  
  return arr;
}

// ============================================================================
// EXPORTS (for both Node.js and browser)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getSortObject,
    sort,
    sortArray
  };
}

// ============================================================================
// UNIT TESTS
// ============================================================================

function runTests() {
  console.log('Running tuneContourSort tests...\n');
  
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
  console.log('Test 1: Basic encoding - G major held note');
  const abc1 = `X:1
T: Test 1
R: jig
L:1/8
M:12/8
K:G major
G2B`;
  
  const obj1 = getSortObject(abc1);
  assert(obj1.sortKey.startsWith('515055'), 'G major G2B starts with 51 50 55 (G held, B)');
  console.log(`  Sort key: ${obj1.sortKey}\n`);
  
  // Test 2: Held vs repeated notes
  console.log('Test 2: Held vs repeated notes');
  const abcHeld = `X:1\nL:1/8\nK:C\nC2`;
  const abcRepeated = `X:1\nL:1/8\nK:C\nCC`;
  
  const objHeld = getSortObject(abcHeld);
  const objRepeated = getSortObject(abcRepeated);
  
  assert(objHeld.sortKey === '5150', 'C2 encodes as 51 50');
  assert(objRepeated.sortKey === '5151', 'CC encodes as 51 51');
  assert(sort(objHeld, objRepeated) === -1, 'Held note sorts before repeated note');
  console.log(`  Held: ${objHeld.sortKey}, Repeated: ${objRepeated.sortKey}\n`);
  
  // Test 3: Subdivisions
  console.log('Test 3: Subdivisions');
  const abcSub = `X:1\nL:1/8\nK:C\nC/D/E`;
  const objSub = getSortObject(abcSub);
  
  assert(objSub.sortKey === '515355', 'C/D/E encodes as 51 53 55');
  assert(objSub.rhythmicDivisions && objSub.rhythmicDivisions.length === 2, 'Two subdivisions recorded');
  assert(objSub.rhythmicDivisions[0].divisor === 2, 'First subdivision has divisor 2');
  console.log(`  Sort key: ${objSub.sortKey}`);
  console.log(`  Divisions: ${JSON.stringify(objSub.rhythmicDivisions)}\n`);
  
  // Test 4: Octave shifts
  console.log('Test 4: Octave shifts');
  const abcOctaves = `X:1\nL:1/8\nK:C\nC, C c c'`;
  const objOctaves = getSortObject(abcOctaves);
  
  assert(objOctaves.sortKey.substring(0, 2) === '43', 'C, (one octave down) encodes as 43');
  assert(objOctaves.sortKey.substring(2, 4) === '51', 'C (primary octave) encodes as 51');
  assert(objOctaves.sortKey.substring(4, 6) === '5f', 'c (one octave up) encodes as 5f');
  assert(objOctaves.sortKey.substring(6, 8) === '6d', "c' (two octaves up) encodes as 6d");
  console.log(`  Sort key: ${objOctaves.sortKey}\n`);
  
  // Test 5: The Munster (from spec)
  console.log('Test 5: The Munster');
  const abcMunster = `X:1
T: The Munster
R: jig
L:1/8
M:12/8
K:G major
G2B AGA B2d gdB`;
  
  const objMunster = getSortObject(abcMunster);
  assert(objMunster.sortKey === '5150555351535554595f5955', 
    'The Munster matches expected sort key');
  console.log(`  Sort key: ${objMunster.sortKey}\n`);
  
  // Test 6: Different keys, same contour
  console.log('Test 6: Different keys, same contour');
  const abcG = `X:1\nL:1/8\nK:G\nGAB`;
  const abcD = `X:1\nL:1/8\nK:D\nDEF`;
  
  const objG = getSortObject(abcG);
  const objD = getSortObject(abcD);
  
  assert(objG.sortKey === objD.sortKey, 'Same modal contour in different keys produces same sort key');
  console.log(`  G major: ${objG.sortKey}`);
  console.log(`  D major: ${objD.sortKey}\n`);
  
  // Test 7: Array sorting
  console.log('Test 7: Array sorting');
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


	// Test 8: Array sorting
	console.log('Test 8: Array sorting');
	const theFlogging = { name: 'The Flogging', abc: `X: 12
T: The Flogging
R: reel
M: 4/2
L: 1/8
K: Gmaj
BGGA BGdG BGGA Bdgd|
` }, theColliers = { name: 'The Colliers’', abc: `
X:1
T: The Colliers’
R: reel
L:1/8
M:4/2
K:D mixo
FDE/F/G A2AB cAdB cAG2 |` }, tunes2= [
	theFlogging, theColliers
	
	], 
	tunes3 = [theColliers,theFlogging]
	sortArray(tunes2);
	sortArray(tunes3);
	
	assert(tunes2[0].name === 'The Flogging', 'flogging sorts first');
	assert(tunes2[1].name === 'The Colliers’', 'colliers’ sorts second');
	console.log(`  Order: ${tunes2.map(t => t.name).join(', ')}\n`);
	assert(tunes3[0].name === 'The Flogging', 'flogging sorts first');
	assert(tunes3[1].name === 'The Colliers’', 'colliers’ sorts second');
	console.log(`  Order: ${tunes3.map(t => t.name).join(', ')}\n`);
  
  
  // Summary
  console.log('='.repeat(50));
  console.log(`Tests completed: ${passed} passed, ${failed} failed`);
  
  return failed === 0;
}

// Run tests if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runTests();
}

/*
(()=>{
//paste here to run
    runTests()
})()
*/