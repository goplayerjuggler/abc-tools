const {Fraction} = require('./math.js');
const {
  parseABCWithBars, 
  extractMeter, 
  extractUnitLength,
  calculateBarDurations
} = require('./parser.js');

// ============================================================================
// ABC manipulation functions
// ============================================================================

/**
 * Normalises an ABC key header into a structured array of tonic, mode, and accidentals.
 * Supports both ASCII and Unicode accidentals, and handles multiple modifying accidentals.
 *
 * @param {string} keyHeader - The contents of the K: header (e.g., "D#m", "Fb maj", "D min ^g ^c").
 * @returns {[string, string, string?]} An array containing:
 *   - The normalised tonic (e.g., "D♯", "F♭").
 *   - The normalised mode (e.g., "minor", "major", "mixolydian").
 *   - Optional: A string of accidentals (e.g., "^g ^c", "=c __f").
 *
 * @example
 * normaliseKey('D#m');            // ["D♯", "minor"]
 * normaliseKey('Fb maj');         // ["F♭", "major"]
 * normaliseKey('G# mixolydian');  // ["G♯", "mixolydian"]
 * normaliseKey('Cion');           // ["C", "major"]
 * normaliseKey('D min ^g ^c');    // ["D", "minor", "^g ^c"]
 * normaliseKey('D maj =c __f');   // ["D", "major", "=c __f"]
 */
function normaliseKey(keyHeader) {
  const key = keyHeader.toLowerCase().trim();
  // Extract note and accidental, normalizing ASCII to Unicode
  const noteMatch = key.match(/^([a-g])(#|b|x|bb|×|♭|♯)?/);
  const noteBase = noteMatch ? noteMatch[1].toUpperCase() : 'C';
  const accidental = noteMatch && noteMatch[2]
    ? noteMatch[2].replace('#', '♯').replace('b', '♭')
    : '';
  const note = noteBase + accidental;

  const modeMap = {
    'maj': 'major', 'major': 'major', 'ion': 'major', 'ionian': 'major',
    'min': 'minor', 'minor': 'minor', 'aeo': 'minor', 'aeolian': 'minor',
    'mix': 'mixolydian', 'mixo': 'mixolydian', 'mixolydian': 'mixolydian',
    'dor': 'dorian', 'dorian': 'dorian',
    'phr': 'phrygian', 'phrygian': 'phrygian',
    'lyd': 'lydian', 'lydian': 'lydian',
    'loc': 'locrian', 'locrian': 'locrian',
  };
  const mode = Object.keys(modeMap).find(m => key.includes(m)) || 'major';

  // Extract all accidentals (e.g., "^g ^c", "__f", "=c")
  const accidentalsMatch = key.match(/(?:^|\s)(?:__|_|=|\^|\^\^)[a-g]/g);
  const accidentals = accidentalsMatch ? accidentalsMatch.join('').trim() : null;

  const result = [note, modeMap[mode]];
  if (accidentals) { result.push(accidentals);}
  return result;
}


/**
 * Filter headers based on configuration
 * @param {Array<string>} headerLines - Array of header line strings
 * @param {object} headersToStrip - Configuration {all:boolean, toKeep:string}
 * @returns {Array<string>} - Filtered header lines
 */
function filterHeaders(headerLines, headersToStrip) {
  if (!headersToStrip || !headersToStrip.all) {
    return headerLines;
  }
  
  // Keep only X, M, L, K headers when stripping
  return headerLines.filter(line => "XMLK".indexOf(line[0]) >= 0);
}

/**
 * Detect if ABC notation has an anacrusis (pickup bar)
 * @param {object} parsed - Parsed ABC data from parseABCWithBars
 * @returns {boolean} - True if anacrusis is present
 */
function hasAnacrucisFromParsed(parsed) {
  const barDurations = calculateBarDurations(parsed);
  const expectedBarDuration = new Fraction(parsed.meter[0], parsed.meter[1]);

  if (parsed.bars.length === 0) {
    return false;
  }

  const firstBarDuration = barDurations[0];
  return firstBarDuration.compare(expectedBarDuration) < 0;
}

/**
 * Detect if ABC notation has an anacrusis (pickup bar)
 * @param {string} abc - ABC notation
 * @returns {boolean} - True if anacrusis is present
 */
function hasAnacrucis(abc) {
  const parsed = parseABCWithBars(abc, { maxBars: 2 });
  return hasAnacrucisFromParsed(parsed);
}

/**
 * Reconstruct music text with line breaks based on original structure
 * Maps line breaks from original to modified music, accounting for bar transformations
 * @param {object} originalParsed - Original parsed ABC source
 * @param {string} modifiedMusic - Modified music text (single line)
 * @param {string} direction - Transformation direction: 'remove' (4/4->4/2) or 'add' (4/2->4/4)
 * @returns {string} - Music text with line breaks inserted
 */
function reconstructMusicWithLineBreaks(originalParsed, modifiedMusic, direction) {
  
  
  // Build set of bar indices that have line breaks after them
  const originalLineBreakBars = new Set();
  for (let i = 0; i < originalParsed.barLines.length; i++) {
    if (originalParsed.barLines[i].hasLineBreak) {
      originalLineBreakBars.add(i);
    }
  }
  
  // If no line breaks in original, return as-is
  if (originalLineBreakBars.size === 0) {
    return modifiedMusic.trim();
  }
  
  // Map original bar indices to modified bar indices based on transformation
  const modifiedLineBreakBars = new Set();
  
  if (direction === 'remove') {
    // Removing every other bar: bar 0,1,2,3,4 -> bar 0,2,4 (bars 1,3 removed)
    // If original had break after bar 2, modified should have break after bar 1
    for (const origBar of originalLineBreakBars) {
      const modifiedBar = Math.floor(origBar / 2);
      modifiedLineBreakBars.add(modifiedBar);
      }
  } else if (direction === 'add') {
    // Adding bars in middle: bar 0,1,2 -> bar 0,1,2,3,4 (new bars at 1,3)
    // If original had break after bar 1, modified should have break after bar 2
    for (const origBar of originalLineBreakBars) {
      const modifiedBar = origBar * 2 + 1; // Map to the second half of split bar
      modifiedLineBreakBars.add(modifiedBar);
    }
  } else {
    // No transformation, use original positions
    for (const bar of originalLineBreakBars) {
      modifiedLineBreakBars.add(bar);
    }
  }
  
  // Find bar lines in modified music
  const barLineRegex = /(\|\]|\[\||(\|:?)|(:?\|)|::|(\|[1-6]))/g;
  const modifiedBarPositions = [];
  let match;
  
  while ((match = barLineRegex.exec(modifiedMusic)) !== null) {
    modifiedBarPositions.push({
      index: match.index,
      length: match[0].length,
      text: match[0]
    });
      }
      
  // Build result with line breaks at mapped positions
  const lines = [];
  let lastPos = 0;
  
  for (let i = 0; i < modifiedBarPositions.length; i++) {
    const barPos = modifiedBarPositions[i];
    
    // Add content up to and including this bar line
    const segment = modifiedMusic.substring(lastPos, barPos.index + barPos.length);
    lastPos = barPos.index + barPos.length;
    
    // Skip whitespace after bar line
    while (lastPos < modifiedMusic.length && modifiedMusic[lastPos] === ' ') {
      lastPos++;
    }
    
    // Check if we should add line break after this bar
    if (modifiedLineBreakBars.has(i)) {
      lines.push(segment.trim());
    } else {
      // Accumulate into current line
      if (lines.length === 0) {
        lines.push(segment.trim());
      } else {
        lines[lines.length - 1] += ' ' + segment.trim();
      }
          }
        }
  
  // Add any remaining content
  if (lastPos < modifiedMusic.length) {
    const remaining = modifiedMusic.substring(lastPos).trim();
    if (remaining) {
      if (lines.length === 0) {
        lines.push(remaining);
      } else {
        lines[lines.length - 1] += ' ' + remaining;
      }
    }
  }
  
  return lines.join('\n');
}

/**
 * Toggle between M:4/4 and M:4/2 by surgically adding/removing bar lines
 * This is a true inverse operation - going there and back preserves the ABC exactly
 * Handles anacrusis correctly
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

  const parsed = parseABCWithBars(abc);
  const {bars, headerLines, barLines, musicText} = parsed;

  // Change meter in headers
  const newHeaders = headerLines.map(line => {
    if (line.match(/^M:/)) {
      return is_4_4 ? 'M:4/2' : 'M:4/4';
    }
    return line;
  });

  const hasPickup = hasAnacrucisFromParsed(parsed);

  if (is_4_4) {
    // Going from 4/4 to 4/2: remove every other bar line (except final)
    const barLinesToRemove = new Set();
    const startIndex = hasPickup ? 1 : 0;

    for (let i = startIndex; i < barLines.length - 1; i += 2) {
      barLinesToRemove.add(barLines[i].sourceIndex);
    }

    // Reconstruct music by removing marked bar lines
    let newMusic = '';
    let lastPos = 0;

    for (let i = 0; i < barLines.length; i++) {
      const barLine = barLines[i];
      newMusic += musicText.substring(lastPos, barLine.sourceIndex);

      if (!barLinesToRemove.has(barLine.sourceIndex)) {
        newMusic += barLine.text;
        lastPos = barLine.sourceIndex + barLine.sourceLength;
      } else {
        // Remove the bar line - skip over it
        lastPos = barLine.sourceIndex + barLine.sourceLength;
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

    // Restore line breaks (removing bars, so direction is 'remove')
    const musicWithLineBreaks = reconstructMusicWithLineBreaks(parsed, newMusic, 'remove');
    
    return `${newHeaders.join('\n')}\n${musicWithLineBreaks}`;

  } else {
    // Going from 4/2 to 4/4: add bar line in middle of each bar
    const halfBarDuration = new Fraction(4, 4);
    const insertionPoints = [];
    const startBarIndex = hasPickup ? 1 : 0;

    for (let barIdx = startBarIndex; barIdx < parsed.bars.length; barIdx++) {
      const bar = parsed.bars[barIdx];
      let barDuration = new Fraction(0, 1);
      let insertPos = null;

      // Find position where we've accumulated half a bar
      for (let noteIdx = 0; noteIdx < bar.length; noteIdx++) {
        const note = bar[noteIdx];
        
        // Skip inline fields, standalone chord symbols, and dummy notes
        if (note.isInlineField || note.isChordSymbol || note.isDummy) {
          continue;
        }
        
        const prevDuration = barDuration.clone();
        barDuration = barDuration.add(note.duration);

        // Check if we've just crossed the halfway point
        if (prevDuration.compare(halfBarDuration) < 0 &&
            barDuration.compare(halfBarDuration) >= 0) {
          // Insert bar line after this note
          insertPos = note.sourceIndex + note.sourceLength;
          // Skip any trailing space that's part of this note
          if (note.spacing && note.spacing.whitespace && musicText[insertPos] === ' ') {
            insertPos++;
          }
          break;
        }
      }

      if (insertPos !== null) {
        insertionPoints.push(insertPos);
      }
    }

    // Insert bar lines at calculated positions
    let newMusic = '';
    let lastPos = 0;

    // Sort insertion points and merge with existing bar lines
    const allPositions = [
      ...barLines.map(bl => ({pos: bl.sourceIndex, isExisting: true, type: bl.text})),
      ...insertionPoints.map(pos => ({pos, isExisting: false, type: '|'}))
    ].sort((a, b) => a.pos - b.pos);

    for (const item of allPositions) {
      newMusic += musicText.substring(lastPos, item.pos);
      newMusic += item.type;
      lastPos = item.isExisting ? item.pos + item.type.length : item.pos;
    }
    newMusic += musicText.substring(lastPos);

    // Restore line breaks (adding bars, so direction is 'add')
    const musicWithLineBreaks = reconstructMusicWithLineBreaks(parsed, newMusic, 'add');
    
    return `${newHeaders.join('\n')}\n${musicWithLineBreaks}`;
  }
}

/**
 * Toggle between M:6/8 and M:12/8 (similar approach)
 * Handles anacrusis correctly
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

  const parsed = parseABCWithBars(abc);
  const {bars, headerLines, barLines, musicText} = parsed;

  const newHeaders = headerLines.map(line => {
    if (line.match(/^M:/)) {
      return is_6_8 ? 'M:12/8' : 'M:6/8';
    }
    return line;
  });

  // Check for anacrusis
  const hasPickup = hasAnacrucisFromParsed(parsed);

  if (is_6_8) {
    // Going from 6/8 to 12/8: remove every other bar line
    const barLinesToRemove = new Set();
    const startIndex = hasPickup ? 1 : 0;

    for (let i = startIndex; i < barLines.length - 1; i += 2) {
      barLinesToRemove.add(barLines[i].sourceIndex);
    }

    let newMusic = '';
    let lastPos = 0;

    for (let i = 0; i < barLines.length; i++) {
      const barLine = barLines[i];
      newMusic += musicText.substring(lastPos, barLine.sourceIndex);

      if (!barLinesToRemove.has(barLine.sourceIndex)) {
        newMusic += barLine.text;
        lastPos = barLine.sourceIndex + barLine.sourceLength;
      } else {
        lastPos = barLine.sourceIndex + barLine.sourceLength;
        if (lastPos < musicText.length && /\s/.test(musicText[lastPos])) {
          newMusic += ' ';
          while (lastPos < musicText.length && /\s/.test(musicText[lastPos])) {
            lastPos++;
          }
        }
      }
    }
    newMusic += musicText.substring(lastPos);

    // Restore line breaks (removing bars, so direction is 'remove')
    const musicWithLineBreaks = reconstructMusicWithLineBreaks(parsed, newMusic, 'remove');
    
    return `${newHeaders.join('\n')}\n${musicWithLineBreaks}`;

  } else {
    // Going from 12/8 to 6/8: add bar line in middle of each bar
    const halfBarDuration = new Fraction(6, 8);
    const insertionPoints = [];
    const startBarIndex = hasPickup ? 1 : 0;

    for (let barIdx = startBarIndex; barIdx < parsed.bars.length; barIdx++) {
      const bar = parsed.bars[barIdx];
      let barDuration = new Fraction(0, 1);
      let insertPos = null;

      for (let noteIdx = 0; noteIdx < bar.length; noteIdx++) {
        const note = bar[noteIdx];
        
        // Skip inline fields, standalone chord symbols, and dummy notes
        if (note.isInlineField || note.isChordSymbol || note.isDummy) {
          continue;
        }
        
        const prevDuration = barDuration.clone();
        barDuration = barDuration.add(note.duration);

        if (prevDuration.compare(halfBarDuration) < 0 &&
            barDuration.compare(halfBarDuration) >= 0) {
          insertPos = note.sourceIndex + note.sourceLength;
          if (note.spacing && note.spacing.whitespace && musicText[insertPos] === ' ') {
            insertPos++;
          }
          break;
        }
      }

      if (insertPos !== null) {
        insertionPoints.push(insertPos);
      }
    }

    let newMusic = '';
    let lastPos = 0;

    const allPositions = [
      ...barLines.map(bl => ({pos: bl.sourceIndex, isExisting: true, type: bl.text})),
      ...insertionPoints.map(pos => ({pos, isExisting: false, type: '|'}))
    ].sort((a, b) => a.pos - b.pos);

    for (const item of allPositions) {
      newMusic += musicText.substring(lastPos, item.pos);
      newMusic += item.type;
      lastPos = item.isExisting ? item.pos + item.type.length : item.pos;
    }
    newMusic += musicText.substring(lastPos);

    // Restore line breaks using parsed structure
    const musicWithLineBreaks = reconstructMusicWithLineBreaks(parsed, newMusic, bars, barLines, 0, newMusic.length);
    
    return `${newHeaders.join('\n')}\n${musicWithLineBreaks}`;
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
  // Convert numBars to Fraction if it's a number
  const numBarsFraction = typeof numBars === 'number' 
    ? new Fraction(Math.round(numBars * 1000), 1000)
    : numBars;

  // Estimate maxBars needed - simple ceiling with buffer
  const estimatedMaxBars = Math.ceil(numBarsFraction.num / numBarsFraction.den) + 2;
  
  // Parse with estimated maxBars
  const parsed = parseABCWithBars(abc, { maxBars: estimatedMaxBars });
  const {bars, headerLines, barLines, musicText, meter} = parsed;
  
  const barDurations = calculateBarDurations(parsed);
  const expectedBarDuration = new Fraction(meter[0], meter[1]);
  const targetDuration = expectedBarDuration.multiply(numBarsFraction);

  // Find first complete bar index
  let firstCompleteBarIdx = -1;
  for (let i = 0; i < bars.length; i++) {
    const barDuration = barDurations[i];
    if (barDuration.compare(expectedBarDuration) === 0) {
      firstCompleteBarIdx = i;
      break;
    }
  }

  if (firstCompleteBarIdx === -1) {
    throw new Error('No complete bars found');
  }

  const hasPickup = firstCompleteBarIdx > 0;

  // Filter headers if requested
  const filteredHeaders = filterHeaders(headerLines, headersToStrip);

  // Determine starting position in the music text
  let startPos = 0;
  if (hasPickup && withAnacrucis) {
    // Include anacrusis in output
    startPos = 0;
  } else if (hasPickup && !withAnacrucis) {
    // Skip anacrusis - start after its bar line
    const anacrusisBarLine = barLines[firstCompleteBarIdx - 1];
    if (anacrusisBarLine) {
      startPos = anacrusisBarLine.sourceIndex + anacrusisBarLine.sourceLength;
    }
  }

  // Calculate accumulated duration for target calculation
  let accumulatedDuration = new Fraction(0, 1);
  if (hasPickup && withAnacrucis && countAnacrucisInTotal) {
    // Count anacrusis toward target
    accumulatedDuration = barDurations[0];
  }

  // Find the end position by accumulating bar durations from first complete bar
  let endPos = startPos;
  
  for (let i = firstCompleteBarIdx; i < bars.length; i++) {
    const barDuration = barDurations[i];
    const newAccumulated = accumulatedDuration.add(barDuration);
    
    if (newAccumulated.compare(targetDuration) >= 0) {
      // We've reached or exceeded target
      
      if (newAccumulated.compare(targetDuration) === 0) {
        // Exact match - include full bar with its bar line
        if (i < barLines.length) {
          endPos = barLines[i].sourceIndex + barLines[i].sourceLength;
        }
      } else {
        // Need partial bar
        const remainingDuration = targetDuration.subtract(accumulatedDuration);
        const bar = bars[i];
        let barAccumulated = new Fraction(0, 1);
        
        for (const note of bar) {
          // Skip inline fields, standalone chord symbols, and dummy notes for duration calculation
          if (note.isInlineField || note.isChordSymbol || note.isDummy) {
            continue;
          }
          
          barAccumulated = barAccumulated.add(note.duration);
          
          // Check if we've reached or exceeded the remaining duration
          if (barAccumulated.compare(remainingDuration) >= 0) {
            // Include this note
            endPos = note.sourceIndex + note.sourceLength;
            
            // Skip trailing space if present
            if (note.spacing && note.spacing.whitespace && endPos < musicText.length && musicText[endPos] === ' ') {
              endPos++;
            }
            break;
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

  // Extract the music section with line breaks restored (no transformation)
  const selectedMusic = reconstructMusicWithLineBreaks(parsed, musicText.substring(startPos, endPos), null);

  // Reconstruct ABC
  return `${filteredHeaders.join('\n')}\n${selectedMusic}`;
}

/**
 * Get incipit (opening bars) of a tune for display/search purposes
 * @param {object} Object of the form {abc} with optional property: numBars
 * @param {string} params.abc - ABC notation
 * @param {number|Fraction} params.numBars - Number of bars to return, counting the anacrucis if there is one. (default:2)
 * @returns {string} - ABC incipit
 */
function getIncipit({abc, numBars//, part=null
  } = {}){

  if(!numBars){
    numBars = 2;
    const currentMeter = extractMeter(abc);
    const unitLength = extractUnitLength(abc);
    if(
      (currentMeter[0] === 4 && currentMeter[1] === 4  && unitLength.den === 16)
      || (currentMeter[0] === 4 && currentMeter[1] === 2  && unitLength.den === 8)
      || (currentMeter[0] === 12 && currentMeter[1] === 8 )
    ) {
      numBars = new Fraction(3,2);
    }
  }
  return getFirstBars(abc, numBars, true, true, {all: true} );
}

module.exports = {
  getFirstBars,
  getIncipit,
  hasAnacrucis,
  toggleMeter_4_4_to_4_2,
  toggleMeter_6_8_to_12_8,
  filterHeaders, normaliseKey
};