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
 * @returns headerLines, musicText, musicLines, barLines
 */
function findBarLinePositions(abc, headersToStrip) {
  const lines = abc.split('\n');
  const musicLines = [];
  let headerEndIndex = 0;
  let inHeaders = true;

  // Separate headers from music
  for (let i = 0; i < lines.length; i++) {
    let trimmed = lines[i].trim();
    
    // Skip empty and comment lines
    if (trimmed === '' || trimmed.startsWith('%')) {
      continue;
    }
    
    if (inHeaders && trimmed.match(/^[A-Z]:/)) {
      headerEndIndex = i + 1;
      continue;
    }
    inHeaders = false;
    
    // Remove inline comments and line continuations for processing
    trimmed = trimmed.replace(/\s*%.*$/, '').trim();
    trimmed = trimmed.replace(/\\\s*$/, '').trim();
    
    if (trimmed) {
      musicLines.push({lineIndex: i, content: trimmed});
    }
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
        // Skip inline fields, standalone chord symbols, and dummy notes
        if (note.isInlineField || note.isChordSymbol || note.isDummy) {
          continue;
        }
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
    const halfBarDuration = new Fraction(4, 4);
    const insertionPoints = [];
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
        
        // Skip inline fields, standalone chord symbols, and dummy notes
        if (note.isInlineField || note.isChordSymbol || note.isDummy) {
          const searchStart = musicPos + charCount;
          const notePos = musicText.indexOf(note.token, searchStart);
          if (notePos >= 0) {
            charCount = notePos - musicPos + note.token.length;
          }
          continue;
        }
        
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
            if (note.spacing && note.spacing.whitespace && musicText[insertPos] === ' ') {
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
        
        // Skip inline fields, standalone chord symbols, and dummy notes
        if (note.isInlineField || note.isChordSymbol || note.isDummy) {
          const searchStart = musicPos + charCount;
          const notePos = musicText.indexOf(note.token, searchStart);
          if (notePos >= 0) {
            charCount = notePos - musicPos + note.token.length;
          }
          continue;
        }
        
        const prevDuration = barDuration.clone();
        barDuration = barDuration.add(note.duration);

        const searchStart = musicPos + charCount;
        const notePos = musicText.indexOf(note.token, searchStart);

        if (notePos >= 0) {
          charCount = notePos - musicPos + note.token.length;

          if (prevDuration.compare(halfBarDuration) < 0 &&
              barDuration.compare(halfBarDuration) >= 0) {
            insertPos = musicPos + charCount;
            if (note.spacing && note.spacing.whitespace && musicText[insertPos] === ' ') {
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
 * Get the first N complete or partial bars from ABC notation, with or without the anacrusis
 * Preserves all formatting, comments, spacing, and line breaks
 * @param {string} abc - ABC notation
 * @param {number|Fraction} numBars - Number of bars to extract (can be fractional, e.g., 1.5 or new Fraction(3,2))
 * @param {boolean} withAnacrucis - when flagged, the returned result also includes the anacrusis - incomplete bar (default: false)
 * @param {boolean} countAnacrucisInTotal - when true AND withAnacrucis is true, the anacrusis counts toward numBars duration (default: false)
 * @param {object} headersToStrip - optional header stripping configuration {all:boolean, toKeep:string}
 * @returns {string} - ABC with (optionally) the anacrusis, plus the first `numBars` worth of music
 */
function getFirstBars(abc, numBars = 1, withAnacrucis = false, countAnacrucisInTotal = false, headersToStrip) {
  const {headerLines, musicText, barLines} = findBarLinePositions(abc, headersToStrip);
  const analysis = analyzeBarDurations(abc);
  const {bars, expectedBarDuration} = analysis;

  // Convert numBars to Fraction if it's a number
  const numBarsFraction = typeof numBars === 'number' 
    ? new Fraction(Math.round(numBars * 1000), 1000)
    : numBars;

  // Calculate target duration
  const targetDuration = expectedBarDuration.multiply(numBarsFraction);

  // Find first complete bar index
  let firstCompleteBarIdx = -1;
  for (let i = 0; i < bars.length; i++) {
    const barDuration = analysis.barDurations[i];
    if (barDuration.compare(expectedBarDuration) === 0) {
      firstCompleteBarIdx = i;
      break;
    }
  }

  if (firstCompleteBarIdx === -1) {
    throw new Error('No complete bars found');
  }

  const hasPickup = firstCompleteBarIdx > 0;
  
  // Determine starting position in the music text
  let startPos = 0;
  if (hasPickup && withAnacrucis) {
    // Include anacrusis in output
    startPos = 0;
  } else if (hasPickup && !withAnacrucis) {
    // Skip anacrusis - start after its bar line
    startPos = barLines[firstCompleteBarIdx - 1].index + barLines[firstCompleteBarIdx - 1].length;
  }

  // Calculate accumulated duration for target calculation
  let accumulatedDuration = new Fraction(0, 1);
  if (hasPickup && withAnacrucis && countAnacrucisInTotal) {
    // Count anacrusis toward target
    accumulatedDuration = analysis.barDurations[0];
  }

  // Find the end position by accumulating bar durations from first complete bar
  let endPos = startPos;
  
  for (let i = firstCompleteBarIdx; i < bars.length; i++) {
    const barDuration = analysis.barDurations[i];
    const newAccumulated = accumulatedDuration.add(barDuration);
    
    if (newAccumulated.compare(targetDuration) >= 0) {
      // We've reached or exceeded target
      
      if (newAccumulated.compare(targetDuration) === 0) {
        // Exact match - include full bar with its bar line
        endPos = barLines[i].index + barLines[i].length;
      } else {
        // Need partial bar
        const remainingDuration = targetDuration.subtract(accumulatedDuration);
        
        // Find position within this bar
        const bar = bars[i];
        let barAccumulated = new Fraction(0, 1);
        
        // Find where this bar starts in the music text
        let barStartPos;
        if (i === 0) {
          barStartPos = 0;
        } else {
          barStartPos = barLines[i - 1].index + barLines[i - 1].length;
        }
        
        // Skip whitespace at start of bar
        while (barStartPos < musicText.length && /\s/.test(musicText[barStartPos])) {
          barStartPos++;
        }
        
        let notePos = 0;
        for (let j = 0; j < bar.length; j++) {
          const note = bar[j];
          
          // Skip inline fields, standalone chord symbols, and dummy notes for duration calculation
          if (note.isInlineField || note.isChordSymbol || note.isDummy) {
            const searchStart = barStartPos + notePos;
            const noteIndex = musicText.indexOf(note.token, searchStart);
            if (noteIndex >= 0) {
              notePos = noteIndex - barStartPos + note.token.length;
            }
            continue;
          }
          
          barAccumulated = barAccumulated.add(note.duration);
          
          // Find this note in the source text
          const searchStart = barStartPos + notePos;
          const noteIndex = musicText.indexOf(note.token, searchStart);
          
          if (noteIndex >= 0) {
            notePos = noteIndex - barStartPos + note.token.length;
            
            // Check if we've reached or exceeded the remaining duration
            if (barAccumulated.compare(remainingDuration) >= 0) {
              // Include this note
              endPos = noteIndex + note.token.length;
              
              // Skip trailing space if present
              if (note.spacing && note.spacing.whitespace && endPos < musicText.length && musicText[endPos] === ' ') {
                endPos++;
              }
              break;
            }
          }
        }
      }
      break;
    }
    
    accumulatedDuration = newAccumulated;
  }

  if (endPos === startPos) {
    throw new Error(`Not enough bars to satisfy request. Requested ${numBars} bars.`);
  }

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
      numBars = new Fraction(3,2)
    }
  }
  return getFirstBars(abc, numBars, true, true, {all: true} )
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
