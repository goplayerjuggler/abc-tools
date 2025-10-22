const { Fraction } = require("./math.js");
const {
  getTonalBase,
  getUnitLength,
  parseABCWithBars,
  NOTE_TO_DEGREE,
} = require("./parser.js");

/**
 * Tune Contour Sort - Modal melody sorting algorithm
 * Sorts tunes by their modal contour, independent of key and mode
 */

// ============================================================================
// CORE CONSTANTS
// ============================================================================

const OCTAVE_SHIFT = 7; // 7 scale degrees per octave

const baseChar = 0x0420; // middle of cyrillic
const silenceChar = "_"; // silence character

// ============================================================================
// ENCODING FUNCTIONS
// ============================================================================

/**
 * Calculate modal position and octave offset for a note
 * Returns a compact representation: octave * 7 + degree (both 0-indexed)
 */
function calculateModalPosition(tonalBase, pitch, octaveShift) {
  const tonalDegree = NOTE_TO_DEGREE[tonalBase];
  const noteDegree = NOTE_TO_DEGREE[pitch.toUpperCase()];

  // Calculate relative degree (how many scale steps from tonic)
  const relativeDegree = (noteDegree - tonalDegree + 7) % 7;

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
 * This ensures held notes (even codes) sort before played notes (odd codes)
 *
 * @param {number} position - encodes the degree + octave
 * @param {boolean} isHeld - if the note is held or not
 * @returns the encoded modal degree information (MDI). Format: baseChar + (position * 2) + (isHeld ? 0 : 1)
 */
function encodeToChar(position, isHeld) {
  const code = baseChar + position * 2 + (isHeld ? 0 : 1);
  return String.fromCharCode(code);
}

/**
 * Decode a character back to position and held status
 */
function decodeChar(char) {
  if (char === silenceChar) {
    return { isSilence: true, position: null, isHeld: null };
  }

  const code = char.charCodeAt(0) - baseChar;
  const position = Math.floor(code / 2);
  const isHeld = code % 2 === 0;
  return { position, isHeld, isSilence: false };
}

// ============================================================================
// SORT OBJECT (contour) GENERATION
// ============================================================================

/**
 * Generate sort object from ABC notation
 * @returns { sortKey: string, durations: Array, version: string, part: string }
 */
function getContour(abc, options = {}) {
  const tonalBase = getTonalBase(abc);
  const unitLength = getUnitLength(abc);
  const { bars } = parseABCWithBars(abc, options);

  const sortKey = [];
  const durations = [];
  let index = 0;
  // get the parsed notes - notes are tokens with a duration
  const notes = [];
  let tied = false, previousPosition = null
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    for (let j = 0; j < bar.length; j++) {
      const token = bar[j];
      if (token.duration) {
        notes.push(token);
      }
    }
  }

  notes.forEach((note) => {
    const { duration, isSilence } = note;
    const comparison = duration.compare(unitLength);
    const { encoded, encodedHeld, position } = isSilence
      ? { encoded: silenceChar, encodedHeld: silenceChar, position:0 }
      : getEncodedFromNote(note, tonalBase, tied, previousPosition);

    if (note.tied) {
      tied = true
      previousPosition = position
    }
    else {
      tied = false
      previousPosition = null
    }

    if (comparison > 0) {
      // Held note: duration > unitLength
      const ratio = duration.divide(unitLength);
      const nbUnitLengths = Math.floor(ratio.num / ratio.den);
      const remainingDuration = duration.subtract(
        unitLength.multiply(nbUnitLengths)
      );

      // const durationRatio = Math.round(ratio.num / ratio.den);

      // First note is played
      sortKey.push(encoded);

      // Subsequent notes are held
      for (let i = 1; i < nbUnitLengths; i++) {
        sortKey.push(encodedHeld);
      }

      index += nbUnitLengths;
      if (remainingDuration.num !== 0) {
        pushShortNote(encoded, unitLength, duration, index, durations, sortKey);
        index++;
      }
    } else if (comparison < 0) {
      pushShortNote(encoded, unitLength, duration, index, durations, sortKey);

      index++;
    } else {
      // Normal note: duration === unitLength
      sortKey.push(encoded);
      index++;
    }
  });

  return {
    sortKey: sortKey.join(""),
    durations: durations.length > 0 ? durations : undefined,
    // version: "1.0",
    // part,
  };
}

/**
 * Adds a short note (duration < unitLength) to the contour
 * @param {string} encoded - the encoded representation of the note’s modal degree information (MDI)
 * @param {Fraction} unitLength - the unit length
 * @param {Fraction} duration - the duration of the note
 * @param {number} index - the index of the note
 * @param {Array<object>} durations - the durations array
 * @param {Array<string>} sortKey - array of MDIs
 */
function pushShortNote(
  encoded,
  unitLength,
  duration,
  index,
  durations,
  sortKey
) {
  const relativeDuration = duration.divide(unitLength);

  durations.push({
    i: index,
    n: relativeDuration.num === 1 ? undefined : relativeDuration.num,
    d: relativeDuration.den,
  });
  sortKey.push(encoded);
}

// ============================================================================
// COMPARISON FUNCTIONS
// ============================================================================

/**
 * Compare two sort objects using expansion algorithm
 */
function sort(objA, objB) {
  let keyA = objA.sortKey;
  let keyB = objB.sortKey;

  const dursA = objA.durations || [];
  const dursB = objB.durations || [];

  // No durations: simple lexicographic comparison
  if (dursA.length === 0 && dursB.length === 0) {
    return keyA === keyB ? 0 : keyA < keyB ? -1 : 1;
  }

  // Build maps of position -> {n, d}
  const durMapA = Object.fromEntries(
    dursA.map((dur) => [dur.i, { n: dur.n || 1, d: dur.d }])
  );
  const durMapB = Object.fromEntries(
    dursB.map((dur) => [dur.i, { n: dur.n || 1, d: dur.d }])
  );

  let posA = 0;
  let posB = 0;
  let logicalIndex = 0;
  let counter = 0;

  while (posA < keyA.length && posB < keyB.length) {
    if (counter++ > 10000) {
      throw new Error("Sort algorithm iteration limit exceeded");
    }

    const durA = durMapA[logicalIndex];
    const durB = durMapB[logicalIndex];

    // Get durations as fractions
    const fracA = durA ? new Fraction(durA.n, durA.d) : new Fraction(1, 1);
    const fracB = durB ? new Fraction(durB.n, durB.d) : new Fraction(1, 1);

    const comp = fracA.compare(fracB);

    if (comp === 0) {
      // Same duration, compare characters directly
      const charA = keyA.charAt(posA);
      const charB = keyB.charAt(posB);

      if (charA < charB) {
        return -1;
      }
      if (charA > charB) {
        return 1;
      }

      posA++;
      posB++;
      logicalIndex++;
    } else if (comp < 0) {
      // fracA < fracB: expand B by inserting held note
      const charA = keyA.charAt(posA);
      const charB = keyB.charAt(posB);

      if (charA < charB) {
        return -1;
      }
      if (charA > charB) {
        return 1;
      }

      // Insert held note into B
      const decodedB = decodeChar(charB);
      const heldChar = decodedB.isSilence
        ? silenceChar
        : encodeToChar(decodedB.position, true);

      keyB = keyB.substring(0, posB + 1) + heldChar + keyB.substring(posB + 1);

      // Update duration map for B
      const remainingDur = fracB.subtract(fracA);
      delete durMapB[logicalIndex];

      // Add new duration entry for the held note
      durMapB[logicalIndex + 1] = { n: remainingDur.num, d: remainingDur.den };

      // Shift all subsequent B durations by 1
      const newDurMapB = {};
      for (const idx in durMapB) {
        const numIdx = parseInt(idx);
        if (numIdx > logicalIndex + 1) {
          newDurMapB[numIdx + 1] = durMapB[idx];
        } else {
          newDurMapB[numIdx] = durMapB[idx];
        }
      }
      Object.assign(durMapB, newDurMapB);

      posA++;
      posB++;
      logicalIndex++;
    } else {
      // fracA > fracB: expand A by inserting held note
      const charA = keyA.charAt(posA);
      const charB = keyB.charAt(posB);

      if (charA < charB) {
        return -1;
      }
      if (charA > charB) {
        return 1;
      }

      // Insert held note into A
      const decodedA = decodeChar(charA);
      const heldChar = decodedA.isSilence
        ? silenceChar
        : encodeToChar(decodedA.position, true);

      keyA = keyA.substring(0, posA + 1) + heldChar + keyA.substring(posA + 1);

      // Update duration map for A
      const remainingDur = fracA.subtract(fracB);
      delete durMapA[logicalIndex];

      durMapA[logicalIndex + 1] = { n: remainingDur.num, d: remainingDur.den };

      // Shift all subsequent A durations by 1
      const newDurMapA = {};
      for (const idx in durMapA) {
        const numIdx = parseInt(idx);
        if (numIdx > logicalIndex + 1) {
          newDurMapA[numIdx + 1] = durMapA[idx];
        } else {
          newDurMapA[numIdx] = durMapA[idx];
        }
      }
      Object.assign(durMapA, newDurMapA);

      posA++;
      posB++;
      logicalIndex++;
    }
  }

  if (posA >= keyA.length && posB >= keyB.length) {
    return 0;
  }
  return posA >= keyA.length ? -1 : 1;
}

/**
 * Sort an array of objects containing ABC notation
 */
function sortArray(arr) {
  for (const item of arr) {
    if (!item.sortObject && item.abc) {
      try {
        item.sortObject = getContour(item.abc);
      } catch (err) {
        console.error(`Failed to generate sort object: ${err.message}`);
        item.sortObject = null;
      }
    }
  }

  arr.sort((a, b) => {
    if (!a.sortObject && !b.sortObject) {
      return 0;
    }
    if (!a.sortObject) {
      return 1;
    }
    if (!b.sortObject) {
      return -1;
    }
    return sort(a.sortObject, b.sortObject);
  });

  return arr;
}

function getEncodedFromNote(note, tonalBase, tied, previousPosition) {

  // Handle pitched note
  const { pitch, octave } = note;
  const position = calculateModalPosition(tonalBase, pitch, octave);
  const encodedHeld = encodeToChar(position, true);
  const encoded = encodeToChar(position, false);

  return { 
    encoded : 
      tied && position === previousPosition 
      ? encodedHeld
      : encoded, 
    encodedHeld, 
    position };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  getContour,
  sort,
  sortArray,
  decodeChar,
  encodeToChar,
  calculateModalPosition,
};
