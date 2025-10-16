/**
 * Tune Contour Sort - Modal melody sorting algorithm
 * Sorts tunes by their modal contour, independent of key and mode
 * @version 1.1.2
 * shelved - unfinished work with triplets
 */

// ============================================================================
// CORE CONSTANTS
// ============================================================================

const OCTAVE_SHIFT = 7; // 7 scale degrees per octave
//const TONIC_BASE = 1;   // Tonic = scale degree 1

// Note name to scale degree offset (C=0, D=1, E=2, F=3, G=4, A=5, B=6)
const NOTE_TO_DEGREE = { 'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'A': 5, 'B': 6 };

// Tonal base to its degree offset from C
const TONAL_BASE_OFFSET = {
  'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'A': 5, 'B': 6
};

// const baseChar = 0xE000;
//Uses Unicode Private Use Area (U+E000 to U+F8FF)
 const baseChar = 0x0415//middle of cyrillic
 0x0041;//ascii a

// ============================================================================
// ABC PARSING UTILITIES
// ============================================================================

/**
 * Extract key signature from ABC header
 */
function extractTonalBase(abc) {
  const keyMatch = abc.match(/^K:\s*([A-G])/m);
  if (!keyMatch) {
    throw new Error('No key signature found in ABC');
  }
  return keyMatch[1].toUpperCase();
}

/**
 * Extract unit note length as a Fraction object
 */
function extractUnitLength(abc) {
  const lengthMatch = abc.match(/^L:\s*(\d+)\/(\d+)/m);
  if (lengthMatch) {
    return new Fraction(parseInt(lengthMatch[1]), parseInt(lengthMatch[2]));
  }
  return new Fraction(1, 8); // Default to 1/8
}

/**
 * Parse ABC note to extract pitch, octave, and duration
 */
function parseNote(noteStr, unitLength) {
  if (noteStr.match(/^[zx]/i)) return null; // Rest

  const pitchMatch = noteStr.match(/[A-Ga-g]/);
  if (!pitchMatch) return null;
  
  const pitch = pitchMatch[0];
  
  // Count octave modifiers
  const upOctaves = (noteStr.match(/'/g) || []).length;
  const downOctaves = (noteStr.match(/,/g) || []).length;
  const octave = upOctaves - downOctaves;
  
  // Parse duration as Fraction
  let duration = unitLength.clone();
  
  // Handle explicit multipliers (e.g., '2', '3')
  const multMatch = noteStr.match(/(\d+)(?![\/])/);
  if (multMatch) {
    duration = duration.multiply(parseInt(multMatch[1]));
  }
  
  // Handle divisions (e.g., '/', '//', '///')
  const divMatch = noteStr.match(/\/+/);
  if (divMatch) {
    const slashes = divMatch[0].length;
    duration = duration.divide(Math.pow(2, slashes));
  }
  
  // Handle explicit fractions (e.g., '_3/2_')
  const fracMatch = noteStr.match(/_(\d+)\/(\d+)_/);
  if (fracMatch) {
    duration = unitLength.multiply(parseInt(fracMatch[1])).divide(parseInt(fracMatch[2]));
  }
  
  return { pitch, octave, duration };
}

/**
 * Tokenise ABC music notation into individual notes and the triplet sign `(3` or `(3:`
 */
function tokeniseABC(abc) {
  const lines = abc.split('\n');
  let musicLines = [];
  let inHeaders = true;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('%')) continue;
    
    if (inHeaders && trimmed.match(/^[A-Z]:/)) continue;
    inHeaders = false;
    musicLines.push(trimmed);
  }
  
  const music = musicLines.join(' ');
  const tokens = music.match(/(\(3:?)|([=^_]?[A-Ga-g][',]*[0-9]*\/?[0-9]*)/g) || [];
  
  return tokens;
}

// ============================================================================
// FRACTION CLASS (to avoid floating point errors)
// ============================================================================

class Fraction {
  constructor(numerator, denominator = 1) {
    if (denominator === 0) throw new Error('Denominator cannot be zero');
    
    const g = gcd(Math.abs(numerator), Math.abs(denominator));
    this.num = numerator / g;
    this.den = denominator / g;
    
    // Keep denominator positive
    if (this.den < 0) {
      this.num = -this.num;
      this.den = -this.den;
    }
  }
  
  clone() {
    return new Fraction(this.num, this.den);
  }
  
  multiply(n) {
    if (typeof n === 'number') {
      return new Fraction(this.num * n, this.den);
    }
    return new Fraction(this.num * n.num, this.den * n.den);
  }
  
  divide(n) {
    if (typeof n === 'number') {
      return new Fraction(this.num, this.den * n);
    }
    return new Fraction(this.num * n.den, this.den * n.num);
  }
  
  compare(other) {
    // Returns -1 if this < other, 0 if equal, 1 if this > other
    const diff = this.num * other.den - other.num * this.den;
    return diff < 0 ? -1 : (diff > 0 ? 1 : 0);
  }
  
  equals(other) {
    return this.num === other.num && this.den === other.den;
  }
  
  isGreaterThan(other) {
    return this.compare(other) > 0;
  }
  
  isLessThan(other) {
    return this.compare(other) < 0;
  }
  
  toString() {
    return this.den === 1 ? `${this.num}` : `${this.num}/${this.den}`;
  }
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a, b) {
  return Math.abs(a * b) / gcd(a, b);
}

// ============================================================================
// ENCODING FUNCTIONS
// ============================================================================

/**
 * Calculate modal degree and octave offset for a note
 * Returns a compact representation: octave * 7 + degree (both 0-indexed)
 */
function calculateModalPosition(tonalBase, pitch, octaveShift) {
  const tonalDegree = TONAL_BASE_OFFSET[tonalBase];
  const noteDegree = NOTE_TO_DEGREE[pitch.toUpperCase()];
  
  // Calculate relative degree (how many scale steps from tonic)
  let relativeDegree = (noteDegree - tonalDegree + 7) % 7;
  
  // Adjust octave: lowercase notes are one octave higher
  let octave = octaveShift;
  if (pitch === pitch.toLowerCase()) {
    octave += 1;
  }
  
  // Return position as single number: octave * 7 + degree
  // Using offset of 2 octaves to keep values positive
  return (octave + 2) * OCTAVE_SHIFT + relativeDegree;
}

/**
 * Encode position and played/held status as a single character
 * Format: baseChar + (position * 2) + (isHeld ? 1 : 0)
 */
function encodeToChar(position, isHeld) {
  // const baseChar = 0xE000;
  const code = baseChar + (position * 2) + (isHeld ? 0 : 1);
  return String.fromCharCode(code);
}

/**
 * Decode a character back to position and held status
 */
function decodeChar(char) {
  // const baseChar = 0xE000;
  const code = char.charCodeAt(0) - baseChar;
  const position = Math.floor(code / 2);
  const isHeld = code % 2 === 0;
  return { position, isHeld };
}

// ============================================================================
// SORT OBJECT GENERATION
// ============================================================================

/**
 * Generate sort object from ABC notation
 * @returns { sortKey: string, rhythmicDivisions: Array, version: string, part: string }
 */
function getSortObject(abc, options = {}) {
  const { nbBars = Infinity, part = 'A' } = options;
  
  const tonalBase = extractTonalBase(abc);
  const unitLength = extractUnitLength(abc);
  const tokens = tokeniseABC(abc);
  
  const sortKey = [];
  const rhythmicDivisions = [];
  
  let barCount = 0;
  let index = 0;
  let triplet = 0;
  
  for (const token of tokens) {
    if (token === '|' || token === '||' || token === '|]') {
      barCount++;
      if (barCount >= nbBars) break;
      continue;
    }
    
    if (token.startsWith('(3')) {
      triplet = 3; continue;
    }
    const note = parseNote(token, unitLength);
    if (!note) continue;
    
    let { pitch, octave, duration } = note;
    if (triplet > 0) {
      duration = duration.divide(3).multiply(2)
      triplet--;
    }
    
    const position = calculateModalPosition(tonalBase, pitch, octave);
    
    const comparison = duration.compare(unitLength);
    
    if (comparison > 0) {
      // Held note: duration > unitLength
      const ratio = duration.divide(unitLength);
      const durationRatio = Math.round(ratio.num / ratio.den);
      
      // First note is played
      sortKey.push(encodeToChar(position, false));
      
      // Subsequent notes are held
      for (let i = 1; i < durationRatio; i++) {
        sortKey.push(encodeToChar(position, true));
      }
      
      index += durationRatio;
    } else if (comparison < 0) {
      // Subdivided note: duration < unitLength
      const ratio = unitLength.divide(duration);
      const divisor = Math.round(ratio.num / ratio.den);
      
      rhythmicDivisions.push({ index, divisor });
      sortKey.push(encodeToChar(position, false));
      index++;
    } else {
      // Normal note: duration === unitLength
      sortKey.push(encodeToChar(position, false));
      index++;
    }
  }
  
  return {
    sortKey: sortKey.join(''),
    rhythmicDivisions: rhythmicDivisions.length > 0 ? rhythmicDivisions : undefined,
    version: '1.1',
    part
  };
}

// ============================================================================
// COMPARISON FUNCTIONS
// ============================================================================

/**
 * Expand a sort key at a given position with held notes
 */
function expandSortKey(sortKey, position, expansionFactor) {
  if (expansionFactor === 1) return sortKey;
  
  const before = sortKey.substring(0, position);
  const noteChar = sortKey.charAt(position);
  const after = sortKey.substring(position + 1);
  
  const { position: pos } = decodeChar(noteChar);
  
  // First occurrence is played, subsequent are held
  const expansions = [noteChar];
  for (let i = 1; i < expansionFactor; i++) {
    expansions.push(encodeToChar(pos, true));
  }
  
  return before + expansions.join('') + after;
}

/**
 * Compare two sort objects
 */
function sort(objA, objB) {
  let keyA = objA.sortKey;
  let keyB = objB.sortKey;
  
  const divsA = objA.rhythmicDivisions || [];
  const divsB = objB.rhythmicDivisions || [];

  // No divisions: simple lexicographic comparison
  if (divsA.length === 0 && divsB.length === 0) {
    return keyA === keyB ? 0 : (keyA < keyB ? -1 : 1);
  }
  
  // Try sorting up to the first division
  let firstDivision = Infinity;
  if (divsA.length > 0) firstDivision = Math.min(firstDivision, divsA[0].index);
  if (divsB.length > 0) firstDivision = Math.min(firstDivision, divsB[0].index);
  
  if (firstDivision > 0) {
    const substA = keyA.substring(0, firstDivision);
    const substB = keyB.substring(0, firstDivision);
    if (substA < substB) return -1;
    if (substA > substB) return 1;
  }

  // Build maps of position -> divisor
  let divMapA = Object.fromEntries(divsA.map(d => [d.index, d.divisor]));
  let divMapB = Object.fromEntries(divsB.map(d => [d.index, d.divisor]));
  
  let posA = 0;
  let posB = 0;
  let logicalIndex = 0;
  let counter = 0;
  
  while (posA < keyA.length && posB < keyB.length) {
    if (counter++ > 1000) throw new Error('Sort algorithm iteration limit exceeded');
    
    const divA = divMapA[logicalIndex] || 1;
    const divB = divMapB[logicalIndex] || 1;
    
    if (divA === divB) {
      // Same duration, compare directly
      const charA = keyA.charAt(posA);
      const charB = keyB.charAt(posB);
      
      if (charA < charB) return -1;
      if (charA > charB) return 1;
      
      posA++;
      posB++;
      logicalIndex++;
    } else {
      // Different durations, expand
      const factor = lcm(divA, divB);
      const expandA = factor / divA;
      const expandB = factor / divB;
      
      keyA = expandSortKey(keyA, posA, expandA);
      keyB = expandSortKey(keyB, posB, expandB);
      
      // Update division maps
      const newDivMapA = {};
      const newDivMapB = {};
      
      for (const idx in divMapA) {
        const numIdx = parseInt(idx);
        if (numIdx > logicalIndex) {
          newDivMapA[numIdx + expandA - 1] = divMapA[idx];
        } else if (numIdx !== logicalIndex) {
          newDivMapA[numIdx] = divMapA[idx];
        }
      }
      
      for (const idx in divMapB) {
        const numIdx = parseInt(idx);
        if (numIdx > logicalIndex) {
          newDivMapB[numIdx + expandB - 1] = divMapB[idx];
        } else if (numIdx !== logicalIndex) {
          newDivMapB[numIdx] = divMapB[idx];
        }
      }
      
    //   Object.assign(divMapA, newDivMapA);
    //   Object.assign(divMapB, newDivMapB);
	 divMapA = newDivMapA
	 divMapB = newDivMapB
    }
  }
  
  if (posA >= keyA.length && posB >= keyB.length) return 0;
  return posA >= keyA.length ? -1 : 1;
}

/**
 * Sort an array of objects containing ABC notation
 */
function sortArray(arr) {
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
  
  arr.sort((a, b) => {
    if (!a.sortObject && !b.sortObject) return 0;
    if (!a.sortObject) return 1;
    if (!b.sortObject) return -1;
    return sort(a.sortObject, b.sortObject);
  });
  
  return arr;
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getSortObject,
    sort,
    sortArray,
    Fraction // Export for testing
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
  console.log(JSON.stringify({objHeld, objRepeated}))
  console.log(`sort(objHeld, objRepeated): ${sort(objHeld, objRepeated)}`)
  
  // Test 3: Subdivisions
  console.log('Test 3a: subdivisions');
  const abcSub = `X:1\nL:1/8\nK:C\nC/D/E`;
  const objSub = getSortObject(abcSub);
  
  assert(objSub.sortKey.length === 3, 'C/D/E has 3 notes');
  assert(objSub.rhythmicDivisions && objSub.rhythmicDivisions.length === 2, 
    'Two subdivisions recorded');
  assert(objSub.rhythmicDivisions[0].divisor === 2, 'First subdivision has divisor 2');
  console.log(`  Divisions: ${JSON.stringify(objSub.rhythmicDivisions)}\n`);
  console.log('Test 3b: subdivisions');
  const abcSub2 = `X:1\nL:1/8\nK:C\n(3CDEF`;
  const objSub2 = getSortObject(abcSub2);
  
  assert(objSub2.sortKey.length === 4, '(3CDEF has 4 notes');
  assert(objSub2.rhythmicDivisions && objSub.rhythmicDivisions.length === 3, 
    '3 subdivisions recorded');
  assert(objSub2.rhythmicDivisions && objSub2.rhythmicDivisions[0].divisor === 3, 'First subdivision has divisor 3');
  console.log(`  Divisions: ${JSON.stringify(objSub2.rhythmicDivisions)}\n`);
  
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

  // Test 8: The Flogging vs The Colliers
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
    name: 'The Colliers2', 
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
  const tunes4 = [theColliers2,theColliers, theFlogging];
  
  sortArray(tunes2);
  
  assert(tunes2[0].name === 'The Flogging', 'The Flogging sorts first (original order)');
  assert(tunes2[1].name === 'The Colliers', 'The Colliers sorts second');
  console.log(`  Order: ${tunes2.map(t => t.name).join(', ')}\n`);
  sortArray(tunes3);
  assert(tunes3[0].name === 'The Flogging', 'The Flogging sorts first (reversed order)');
  assert(tunes3[1].name === 'The Colliers', 'The Colliers sorts second');
  console.log(`sorting 3 tunes`)
  sortArray(tunes4);
  assert(tunes4[1].name === 'The Colliers2', 'The Colliers2 sorts 2nd');
  assert(tunes4[2].name === 'The Colliers', 'The Colliers sorts 3rd');
  console.log(`  Order: ${tunes4.map(t => t.name).join(', ')}\n`);
  console.log(JSON.stringify({theColliers, theColliers2}))
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
