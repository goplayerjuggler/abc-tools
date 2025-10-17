const {Fraction} = require('./math.js');
const {parseABCWithBars, extractMeter, extractUnitLength} = require('./parser.js');

// ============================================================================
// ABC manipulation functions
// ============================================================================
/**
 * Find all bar line positions in the ABC source
 * Returns array of {index, type, barNumber} where index is position in music section
 * @param {string} abc the ABC source to be parsed
 * @param {object} headersToStrip of the form {all:boolean, toKeep:string}. toKeep not yet implemented
 * @returns headerLines,
    musicText,
    musicLines,
    barLines
 */
function findBarLinePositions(abc, headersToStrip) {
  const lines = abc.split('\n');
  const musicLines = [];
  let headerEndIndex = 0;
  let inHeaders = true;

  // Separate headers from music
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '' || trimmed.startsWith('%')) {
      continue;
    }
    if (inHeaders && trimmed.match(/^[A-Z]:/)) {
      headerEndIndex = i + 1;
      continue;
    }
    inHeaders = false;
    musicLines.push({lineIndex: i, content: lines[i]});
  }

  // Join music lines to get continuous music text
  const musicText = musicLines.map(l => l.content).join('\n');

  // Find all bar lines with their positions
  const barLines = [];
  const barLineRegex = /(\|\]|\[\||\|+)/g;
  let match;
  let barNumber = 0;

  while ((match = barLineRegex.exec(musicText)) !== null) {
    const barLine = match[1];
    barLines.push({
      index: match.index,
      type: barLine,
      barNumber: barNumber++,
      length: barLine.length
    });
  }
  const headerLines = headersToStrip && headersToStrip.all
    ? lines.slice(0, headerEndIndex).filter(s=>"XMLK".indexOf(s[0]) >= 0)
    : lines.slice(0, headerEndIndex)

  return {
    headerLines,
    musicText,
    musicLines,
    barLines
  };
}

/**
 * Calculate bar durations to identify which bars to merge/split
 */
function analyzeBarDurations(abc) {
  const parsed = parseABCWithBars(abc);
  const {bars, unitLength, meter} = parsed;

  const expectedBarDuration = new Fraction(meter[0], meter[1]);

  return {
    bars,
    unitLength,
    meter,
    expectedBarDuration,
    barDurations: bars.map(bar => {
      let total = new Fraction(0, 1);
      for (const note of bar) {
        total = total.add(note.duration);
      }
      return total;
    })
  };
}

/**
 * Detect if ABC notation has an anacrusis (pickup bar)
 * @param {string} abc - ABC notation
 * @returns {boolean} - True if anacrusis is present
 */
function hasAnacrucis(abc) {
  const analysis = analyzeBarDurations(abc);
  const {bars, expectedBarDuration} = analysis;

  if (bars.length === 0) {
    return false;
  }

  // Check if first bar is incomplete
  const firstBarDuration = analysis.barDurations[0];
  return firstBarDuration.compare(expectedBarDuration) < 0;
}

/**
 * Toggle between M:4/4 and M:4/2 by surgically adding/removing bar lines
 * This is a true inverse operation - going there and back preserves the ABC exactly
 * Now handles anacrusis correctly
 */
function toggleMeter_4_4_to_4_2(abc) {
  const currentMeter = extractMeter(abc);
  const unitLength = extractUnitLength(abc);

  // Check if L:1/8
  if (unitLength.compare(new Fraction(1, 8)) !== 0) {
    throw new Error('This function only works with L:1/8');
  }

  const is_4_4 = currentMeter[0] === 4 && currentMeter[1] === 4;
  const is_4_2 = currentMeter[0] === 4 && currentMeter[1] === 2;

  if (!is_4_4 && !is_4_2) {
    throw new Error('Meter must be 4/4 or 4/2');
  }

  // Get bar line positions
  const {headerLines, musicText, barLines} = findBarLinePositions(abc);

  // Change meter in headers
  const newHeaders = headerLines.map(line => {
    if (line.match(/^M:/)) {
      return is_4_4 ? 'M:4/2' : 'M:4/4';
    }
    return line;
  });

  // Check for anacrusis
  const hasPickup = hasAnacrucis(abc);

  if (is_4_4) {
    // Going from 4/4 to 4/2: remove every other bar line (except final)
    // If anacrusis: Anacrusis | Bar0 | Bar1 | Bar2 | Bar3 |]
    //               barLine[0] barLine[1] barLine[2] barLine[3] barLine[4]
    // Keep anacrusis, merge: (Bar0 + Bar1) | (Bar2 + Bar3) |]
    // Remove bar lines at indices: 1, 3, ... (odd indices after anacrusis, but not the last)
    //
    // If no anacrusis: Bar0 | Bar1 | Bar2 | Bar3 |]
    //                  barLine[0] barLine[1] barLine[2] barLine[3]
    // Merge: (Bar0 + Bar1) | (Bar2 + Bar3) |]
    // Remove bar lines at indices: 0, 2, ... (even indices, but not the last)

    const barLinesToRemove = new Set();
    const startIndex = hasPickup ? 1 : 0;

    for (let i = startIndex; i < barLines.length - 1; i += 2) {
      barLinesToRemove.add(barLines[i].index);
    }

    // Reconstruct music by removing marked bar lines
    let newMusic = '';
    let lastPos = 0;

    for (let i = 0; i < barLines.length; i++) {
      const barLine = barLines[i];
      newMusic += musicText.substring(lastPos, barLine.index);

      if (!barLinesToRemove.has(barLine.index)) {
        newMusic += barLine.type;
        lastPos = barLine.index + barLine.length;
      } else {
        // Remove the bar line - skip over it
        lastPos = barLine.index + barLine.length;
        // Preserve one space if there was whitespace
        if (lastPos < musicText.length && /\s/.test(musicText[lastPos])) {
          newMusic += ' ';
          // Skip the whitespace we just added
          while (lastPos < musicText.length && /\s/.test(musicText[lastPos])) {
            lastPos++;
          }
        }
      }
    }
    newMusic += musicText.substring(lastPos);

    return `${newHeaders.join('\n')}\n${newMusic}`;

  } else {
    // Going from 4/2 to 4/4: add bar line in middle of each bar
    // We need to analyze where to split each bar
    // If there's an anacrusis, skip it (first bar)

    const halfBarDuration = new Fraction(4, 4); // 4 quarter notes = 8 eighth notes = half of 4/2 bar

    // Calculate insertion points (middle of each bar)
    const insertionPoints = [];

    // Track cumulative position in music text
    let musicPos = 0;
    const parsed = parseABCWithBars(abc);

    const startBarIndex = hasPickup ? 1 : 0;

    for (let barIdx = startBarIndex; barIdx < parsed.bars.length; barIdx++) {
      const bar = parsed.bars[barIdx];
      let barDuration = new Fraction(0, 1);
      let insertPos = null;
      let charCount = 0;

      // Find position where we've accumulated half a bar
      for (let noteIdx = 0; noteIdx < bar.length; noteIdx++) {
        const note = bar[noteIdx];
        const prevDuration = barDuration.clone();
        barDuration = barDuration.add(note.duration);

        // Find this note in the source text
        const searchStart = musicPos + charCount;
        const notePos = musicText.indexOf(note.token, searchStart);

        if (notePos >= 0) {
          charCount = notePos - musicPos + note.token.length;

          // Check if we've just crossed the halfway point
          if (prevDuration.compare(halfBarDuration) < 0 &&
              barDuration.compare(halfBarDuration) >= 0) {
            // Insert bar line after this note
            insertPos = musicPos + charCount;

            // Skip any trailing space that's part of this note
            if (note.hasFollowingSpace && musicText[insertPos] === ' ') {
              insertPos++;
            }
            break;
          }
        }
      }

      if (insertPos !== null) {
        insertionPoints.push(insertPos);
      }

      // Move past this bar's bar line
      if (barIdx < barLines.length) {
        const barLinePos = musicText.indexOf(barLines[barIdx].type, musicPos);
        if (barLinePos >= 0) {
          musicPos = barLinePos + barLines[barIdx].length;
        }
      }
    }

    // Need to account for anacrusis bar line position
    if (hasPickup && barLines.length > 0) {
      const anacrusisBarLinePos = musicText.indexOf(barLines[0].type, 0);
      if (anacrusisBarLinePos >= 0) {
        musicPos = anacrusisBarLinePos + barLines[0].length;
      }
    } else {
      musicPos = 0;
    }

    // Insert bar lines at calculated positions
    let newMusic = '';
    let lastPos = 0;

    // Sort insertion points and merge with existing bar lines
    const allPositions = [
      ...barLines.map(bl => ({pos: bl.index, isExisting: true, type: bl.type})),
      ...insertionPoints.map(pos => ({pos, isExisting: false, type: '|'}))
    ].sort((a, b) => a.pos - b.pos);

    for (const item of allPositions) {
      newMusic += musicText.substring(lastPos, item.pos);
      newMusic += item.type;
      lastPos = item.isExisting ? item.pos + item.type.length : item.pos;
    }
    newMusic += musicText.substring(lastPos);

    return `${newHeaders.join('\n')}\n${newMusic}`;
  }
}

/**
 * Toggle between M:6/8 and M:12/8 (similar approach)
 * Now handles anacrusis correctly
 */
function toggleMeter_6_8_to_12_8(abc) {
  const currentMeter = extractMeter(abc);
  const unitLength = extractUnitLength(abc);

  if (unitLength.compare(new Fraction(1, 8)) !== 0) {
    throw new Error('This function only works with L:1/8');
  }

  const is_6_8 = currentMeter[0] === 6 && currentMeter[1] === 8;
  const is_12_8 = currentMeter[0] === 12 && currentMeter[1] === 8;

  if (!is_6_8 && !is_12_8) {
    throw new Error('Meter must be 6/8 or 12/8');
  }

  const {headerLines, musicText, barLines} = findBarLinePositions(abc);

  const newHeaders = headerLines.map(line => {
    if (line.match(/^M:/)) {
      return is_6_8 ? 'M:12/8' : 'M:6/8';
    }
    return line;
  });

  // Check for anacrusis
  const hasPickup = hasAnacrucis(abc);

  if (is_6_8) {
    // Going from 6/8 to 12/8: remove every other bar line
    // Handle anacrusis similarly to 4/4->4/2
    const barLinesToRemove = new Set();
    const startIndex = hasPickup ? 1 : 0;

    for (let i = startIndex; i < barLines.length - 1; i += 2) {
      barLinesToRemove.add(barLines[i].index);
    }

    let newMusic = '';
    let lastPos = 0;

    for (let i = 0; i < barLines.length; i++) {
      const barLine = barLines[i];
      newMusic += musicText.substring(lastPos, barLine.index);

      if (!barLinesToRemove.has(barLine.index)) {
        newMusic += barLine.type;
        lastPos = barLine.index + barLine.length;
      } else {
        lastPos = barLine.index + barLine.length;
        if (lastPos < musicText.length && /\s/.test(musicText[lastPos])) {
          newMusic += ' ';
          while (lastPos < musicText.length && /\s/.test(musicText[lastPos])) {
            lastPos++;
          }
        }
      }
    }
    newMusic += musicText.substring(lastPos);

    return `${newHeaders.join('\n')}\n${newMusic}`;

  } else {
    // Going from 12/8 to 6/8: add bar line in middle of each bar
    // Skip anacrusis if present
    const halfBarDuration = new Fraction(6, 8);
    const parsed = parseABCWithBars(abc);
    const insertionPoints = [];
    let musicPos = 0;

    const startBarIndex = hasPickup ? 1 : 0;

    for (let barIdx = startBarIndex; barIdx < parsed.bars.length; barIdx++) {
      const bar = parsed.bars[barIdx];
      let barDuration = new Fraction(0, 1);
      let insertPos = null;
      let charCount = 0;

      for (let noteIdx = 0; noteIdx < bar.length; noteIdx++) {
        const note = bar[noteIdx];
        const prevDuration = barDuration.clone();
        barDuration = barDuration.add(note.duration);

        const searchStart = musicPos + charCount;
        const notePos = musicText.indexOf(note.token, searchStart);

        if (notePos >= 0) {
          charCount = notePos - musicPos + note.token.length;

          if (prevDuration.compare(halfBarDuration) < 0 &&
              barDuration.compare(halfBarDuration) >= 0) {
            insertPos = musicPos + charCount;
            if (note.hasFollowingSpace && musicText[insertPos] === ' ') {
              insertPos++;
            }
            break;
          }
        }
      }

      if (insertPos !== null) {
        insertionPoints.push(insertPos);
      }

      if (barIdx < barLines.length) {
        const barLinePos = musicText.indexOf(barLines[barIdx].type, musicPos);
        if (barLinePos >= 0) {
          musicPos = barLinePos + barLines[barIdx].length;
        }
      }
    }

    let newMusic = '';
    let lastPos = 0;

    const allPositions = [
      ...barLines.map(bl => ({pos: bl.index, isExisting: true, type: bl.type})),
      ...insertionPoints.map(pos => ({pos, isExisting: false, type: '|'}))
    ].sort((a, b) => a.pos - b.pos);

    for (const item of allPositions) {
      newMusic += musicText.substring(lastPos, item.pos);
      newMusic += item.type;
      lastPos = item.isExisting ? item.pos + item.type.length : item.pos;
    }
    newMusic += musicText.substring(lastPos);

    return `${newHeaders.join('\n')}\n${newMusic}`;
  }
}

/**
 * Get the first N complete bars from ABC notation, with or without the anacrusis
 * Preserves all formatting, comments, spacing, and line breaks
 * @param {string} abc - ABC notation
 * @param {number} numBars - Number of bars to extract (default: 1). Todo: handle partial bars - values like 1.5 or new Fraction(3,2)
 * @param {boolean} withAnacrucis - when flagged, the returned result also includes the anacrusis - incomplete bar (default: false)
 * @returns {string} - ABC with (optionally) the anacrusis, plus the first `numBars` complete bars
 */
function getFirstBars(abc, numBars = 1, withAnacrucis = false, headersToStrip) {
  const {headerLines, musicText, barLines} = findBarLinePositions(abc, headersToStrip);
  const analysis = analyzeBarDurations(abc);
  const {bars, expectedBarDuration} = analysis;

  // Find first complete bar (by bar index in the bars array)
  let startBarIdx = -1;
  for (let i = 0; i < bars.length; i++) {
    const barDuration = analysis.barDurations[i];
    if (barDuration.compare(expectedBarDuration) === 0) {
      startBarIdx = i;
      break;
    }
  }

  if (startBarIdx === -1) {
    throw new Error('No complete bars found');
  }

  // Count N complete bars from start
  const endBarIdx = startBarIdx + numBars - 1;

  if (endBarIdx >= bars.length) {
    throw new Error(`Not enough complete bars. Found ${bars.length - startBarIdx} complete bars, requested ${numBars}`);
  }

  // Each bar is followed by a bar line at barLines[i]
  // Bar 0 is followed by barLines[0]
  // Bar 1 is followed by barLines[1], etc.

  // We want bars from startBarIdx to endBarIdx (inclusive)
  // Start after the bar line preceding startBarIdx (which is barLines[startBarIdx - 1])
  // If startBarIdx is 0 (no anacrusis), start from beginning
  // End includes the bar line after endBarIdx (which is barLines[endBarIdx])

  let startPos = 0;
  if (startBarIdx > 0 && !withAnacrucis) {
    // Skip anacrusis - start after its bar line
    startPos = barLines[startBarIdx - 1].index + barLines[startBarIdx - 1].length;
  }
  // If withAnacrucis is true and startBarIdx > 0, we start from beginning (startPos = 0)

  const endPos = barLines[endBarIdx].index + barLines[endBarIdx].length;

  // Extract the music section
  let selectedMusic = musicText.substring(startPos, endPos);

  // Remove leading whitespace
  selectedMusic = selectedMusic.trimStart();

  // Reconstruct ABC

  return `${headerLines.join('\n')}\n${selectedMusic}`;
}
/**
 * 
 * @param {*} Object of the form {abc} with optional property: numBars
 * @returns 
 */
function getIncipit({abc, numBars//, part=null
  } = {}){

  if(!numBars){
    numBars = 2
    const currentMeter = extractMeter(abc);
    const unitLength = extractUnitLength(abc);
    if(
      (currentMeter[0] === 4 && currentMeter[1] === 4  && unitLength.den === 16)
      || (currentMeter[0] === 4 && currentMeter[1] === 2  && unitLength.den === 8)
      || (currentMeter[0] === 12 && currentMeter[1] === 8 )
    ) {
      numBars = 1//new Fraction(3,2)
    }
  }
  return getFirstBars(abc, numBars, true, {all: true} )
}

module.exports = {
  analyzeBarDurations,
  findBarLinePositions,
  getFirstBars,
  getIncipit,
  hasAnacrucis,
  toggleMeter_4_4_to_4_2,
  toggleMeter_6_8_to_12_8
};
