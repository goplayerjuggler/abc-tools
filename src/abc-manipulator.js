const {Fraction} = require('./math.js');
const {parseABCWithBars, extractMeter, extractUnitLength} = require('./abc-parser.js');

// ============================================================================
// ABC MANIPULATION FUNCTIONS
// ============================================================================

/**
 * Calculate the duration of a bar in terms of the unit length
 */
function calculateBarDuration(meter) {
  // Bar duration = meter / unitLength
  // e.g., M:4/4, L:1/8 => (4/4) / (1/8) = 4/4 * 8/1 = 8
  return new Fraction(meter[0], meter[1]);
}

/**
 * Calculate the total duration of notes in a bar
 */
function getBarDuration(bar) {
  let total = new Fraction(0, 1);
  for (const note of bar) {
    total = total.add(note.duration);
  }
  return total;
}

/**
 * Check if a bar is complete (matches the expected bar duration)
 */
function isBarComplete(bar, expectedDuration) {
  const barDuration = getBarDuration(bar);
  return barDuration.compare(expectedDuration) === 0;
}

/**
 * Get the first N complete bars from ABC notation, ignoring anacrusis
 * @param {string} abc - ABC notation
 * @param {number} numBars - Number of bars to extract (default: 1)
 * @returns {string} - ABC with only the first N complete bars
 */
function getFirstBars(abc, numBars = 1) {
  const parsed = parseABCWithBars(abc);
  const {bars, unitLength, meter} = parsed;

  const expectedBarDuration = calculateBarDuration(meter);

  // Find first complete bar
  let startIdx = 0;
  for (let i = 0; i < bars.length; i++) {
    if (isBarComplete(bars[i], expectedBarDuration)) {
      startIdx = i;
      break;
    }
  }

  // Collect N complete bars from start
  const selectedBars = [];
  let count = 0;

  for (let i = startIdx; i < bars.length && count < numBars; i++) {
    if (isBarComplete(bars[i], expectedBarDuration)) {
      selectedBars.push(bars[i]);
      count++;
    }
  }

  if (selectedBars.length === 0) {
    throw new Error('No complete bars found');
  }

  // Reconstruct ABC
  return reconstructABC(unitLength, abc, selectedBars);
}

/**
 * Toggle between M:4/4 and M:4/2 (removes/adds every other bar line)
 * Works with L:1/8
 */
function toggleMeter_4_4_to_4_2(abc) {
  const currentMeter = extractMeter(abc);
  const unitLength = extractUnitLength(abc);

  // Check if L:1/8
  if (unitLength.compare(new Fraction(1, 8)) !== 0) {
    throw new Error('This function only works with L:1/8');
  }

  const is_4_4 = currentMeter[0]===4 && currentMeter[1]===4;
  const is_4_2 = currentMeter[0]===4 && currentMeter[2]===4;

  if (!is_4_4 && !is_4_2) {
    throw new Error('Meter must be 4/4 or 4/2');
  }

  const parsed = parseABCWithBars(abc);
  const {bars//, meter
  	} = parsed;

  if (is_4_4) {
    // Going from 4/4 to 4/2: remove every other bar line
    const newBars = [];
    for (let i = 0; i < bars.length; i += 2) {
      if (i + 1 < bars.length) {
        // Merge two bars
        newBars.push([...bars[i], ...bars[i + 1]]);
      } else {
        // Odd number of bars, keep the last one
        newBars.push(bars[i]);
      }
    }
    return reconstructABC(unitLength, abc, newBars, 'M:4/2');
  } else {
    // Going from 4/2 to 4/4: split each bar in half
    const newBars = [];
    const halfBarDuration = new Fraction(8, 1); // 4/4 with L:1/8 = 8 units

    for (const bar of bars) {
      let currentDuration = new Fraction(0, 1);
      const firstHalf = [];
      const secondHalf = [];
      let inSecondHalf = false;

      for (const note of bar) {
        if (!inSecondHalf && currentDuration.compare(halfBarDuration) >= 0) {
          inSecondHalf = true;
        }

        if (inSecondHalf) {
          secondHalf.push(note);
        } else {
          firstHalf.push(note);
        }

        currentDuration = currentDuration.add(note.duration);
      }

      newBars.push(firstHalf);
      if (secondHalf.length > 0) {
        newBars.push(secondHalf);
      }
    }

    return reconstructABC(unitLength, abc, newBars, 'M:4/4');
  }
}

//todo:inverse function

/**
 * Toggle between M:6/8 and M:12/8 (removes/adds every other bar line)
 * Works with L:1/8
 */
function toggleMeter_6_8_to_12_8(abc) {
  const currentMeter = extractMeter(abc);
  const unitLength = extractUnitLength(abc);

  // Check if L:1/8
  if (unitLength.compare(new Fraction(1, 8)) !== 0) {
    throw new Error('This function only works with L:1/8');
  }

  const is_6_8 = currentMeter[0] === 6 && currentMeter[1] === 8;
  const is_12_8 = currentMeter[0] === 12 && currentMeter[1] === 8;

  if (!is_6_8 && !is_12_8) {
    throw new Error('Meter must be 6/8 or 12/8');
  }

  const parsed = parseABCWithBars(abc);
  const {bars} = parsed;

  if (is_6_8) {
    // Going from 6/8 to 12/8: remove every other bar line
    const newBars = [];
    for (let i = 0; i < bars.length; i += 2) {
      if (i + 1 < bars.length) {
        newBars.push([...bars[i], ...bars[i + 1]]);
      } else {
        newBars.push(bars[i]);
      }
    }
    return reconstructABC(unitLength, abc, newBars, 'M:12/8');
  } else {
    // Going from 12/8 to 6/8: split each bar in half
    const newBars = [];
    const halfBarDuration = new Fraction(6, 1); // 6/8 with L:1/8 = 6 units

    for (const bar of bars) {
      let currentDuration = new Fraction(0, 1);
      const firstHalf = [];
      const secondHalf = [];
      let inSecondHalf = false;

      for (const note of bar) {
        if (!inSecondHalf && currentDuration.compare(halfBarDuration) >= 0) {
          inSecondHalf = true;
        }

        if (inSecondHalf) {
          secondHalf.push(note);
        } else {
          firstHalf.push(note);
        }

        currentDuration = currentDuration.add(note.duration);
      }

      newBars.push(firstHalf);
      if (secondHalf.length > 0) {
        newBars.push(secondHalf);
      }
    }

    return reconstructABC(unitLength, abc, newBars, 'M:6/8');
  }
}

//todo:inverse function

/**
 * Convert hornpipe (M:4/4) to swing notation (M:12/8)
 * Converts pairs of equal-duration notes to swing rhythm
 * e.g., D2 FA -> D3 F2A (where the pair FA becomes F2A)
 */
function hornpipeToSwing(abc) {
  const currentMeter = extractMeter(abc);
  const unitLength = extractUnitLength(abc);

  // Check if M:4/4 and L:1/8
  if (!(currentMeter[0]===4 && currentMeter[1]===4)) {
    throw new Error('This function only works with M:4/4');
  }
  if (unitLength.compare(new Fraction(1, 8)) !== 0) {
    throw new Error('This function only works with L:1/8');
  }

  const parsed = parseABCWithBars(abc);
  const {bars} = parsed;

  const swingBars = [];

  for (const bar of bars) {
    const swingBar = [];
    let i = 0;

    while (i < bar.length) {
      const note = bar[i];

      // Check if this note and the next form a pair of equal single-unit notes
      if (i + 1 < bar.length) {
        const nextNote = bar[i + 1];
        const isEqualPair =
          note.duration.compare(new Fraction(1, 1)) === 0 &&
          nextNote.duration.compare(new Fraction(1, 1)) === 0;

        if (isEqualPair) {
          // Convert to swing: first note gets 2 units, second gets 1 unit
          swingBar.push({
            ...note,
            duration: new Fraction(2, 1)
          });
          swingBar.push({
            ...nextNote,
            duration: new Fraction(1, 1)
          });
          i += 2;
          continue;
        }
      }

      // Not a pair, multiply duration by 1.5 (convert 4/4 to 12/8 proportionally)
      swingBar.push({
        ...note,
        duration: note.duration.multiply(new Fraction(3, 2))
      });
      i++;
    }

    swingBars.push(swingBar);
  }

  return reconstructABC(unitLength, abc, swingBars, 'M:12/8');
}

/**
 * Reconstruct ABC notation from header and bars of notes
 */
function reconstructABC(unitLength, originalABC, bars, newMeter = null) {
  // Extract headers
  const lines = originalABC.split('\n');
  const headers = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^[A-Z]:/)) {
      // Replace meter if specified
      if (newMeter && trimmed.match(/^M:/)) {
        headers.push(newMeter);
      } else {
        headers.push(trimmed);
      }
    } else if (trimmed && !trimmed.startsWith('%')) {
      break;
    }
  }

  // Reconstruct music
  const musicLines = [];
  let currentLine = '';

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];

    for (const note of bar) {
      currentLine += formatNote(note, unitLength) + (note.hasFollowingSpace ? ' ' : '');
    }

    currentLine+='|';

    //todo: detect new lines and store them in bars and notes. Keep original line breaks. No longer do the following line break rule.
    // Break into lines every 4 bars
    if ((i + 1) % 4 === 0) {
      musicLines.push(currentLine);
      currentLine = [];
    }
  }

  // Add remaining notes
  if (currentLine.length > 0) {

    musicLines.push(currentLine);
  } else if (musicLines.length > 0) {
    // Change last bar line to final bar line
    const lastLine = musicLines[musicLines.length - 1];
    musicLines[musicLines.length - 1] = lastLine.replace(/\|$/, '|]');
  }

  return `${headers.join('\n')  }\n${  musicLines.join('\n')}`;
}

/**
 * Format a note object back to ABC notation
 */
function formatNote(note, unitLength) {
  if (note.isSilence) {
    return formatDuration('z', note.duration, unitLength);
  }

  let result = note.pitch;

  // Add octave markers
  if (note.octave > 0) {
    result += "'".repeat(note.octave);
  } else if (note.octave < 0) {
    result += ','.repeat(-note.octave);
  }

  return formatDuration(result, note.duration, unitLength);
}

/**
 * Format duration for ABC notation
 * todo: triplets
 */
function formatDuration(noteStr, duration, unitLength) {

  const durationInUnitLength = duration.divide(unitLength);

  if (durationInUnitLength.num === 1 && durationInUnitLength.den === 1) {
    return noteStr;
  }

  if (durationInUnitLength.den === 1) {
    return noteStr + durationInUnitLength.num;
  }

  if (durationInUnitLength.num === 1) {
    if (durationInUnitLength.den === 2) {
      return `${noteStr  }/`;
    }
    if (durationInUnitLength.den === 4) {
      return `${noteStr  }//`;
    }
  }


  return `${noteStr + durationInUnitLength.num  }/${  durationInUnitLength.den}`;
}

module.exports = {
  getFirstBars,
  toggleMeter_4_4_to_4_2,
  toggleMeter_6_8_to_12_8,
  hornpipeToSwing,
  calculateBarDuration,
  getBarDuration,
  isBarComplete
};
