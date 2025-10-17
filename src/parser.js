const {Fraction} = require('./math.js');

// ============================================================================
// ABC PARSING UTILITIES
// ============================================================================

const NOTE_TO_DEGREE = { 'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'A': 5, 'B': 6 };

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
 * Extract meter from ABC header
 */
function extractMeter(abc) {
  const meterMatch = abc.match(/^M:\s*(\d+)\/(\d+)/m);
  if (meterMatch) {
    return [parseInt(meterMatch[1]), parseInt(meterMatch[2])];
  }
  return [4, 4]; // Default to 4/4
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
  // Check for rest/silence
  if (noteStr.match(/^[zx]/i)) {
    let duration = unitLength.clone();

    // Handle explicit fractions first (e.g., '3/2', '2/3')
    const fracMatch = noteStr.match(/(\d+)\/(\d+)/);
    if (fracMatch) {
      duration = unitLength.multiply(parseInt(fracMatch[1])).divide(parseInt(fracMatch[2]));
    } else {
      // Handle explicit multipliers (e.g., '2', '3')
      const multMatch = noteStr.match(/(\d+)(?![/])/);
      if (multMatch) {
        duration = duration.multiply(parseInt(multMatch[1]));
      }

      // Handle divisions (e.g., '/', '//', '///')
      const divMatch = noteStr.match(/\/+/);
      if (divMatch) {
        const slashes = divMatch[0].length;
        duration = duration.divide(Math.pow(2, slashes));
      }
    }

    return { isSilence: true, duration };
  }

  const pitchMatch = noteStr.match(/[A-Ga-g]/);
  if (!pitchMatch) {return null;}

  const pitch = pitchMatch[0];

  // Count octave modifiers
  const upOctaves = (noteStr.match(/'/g) || []).length;
  const downOctaves = (noteStr.match(/,/g) || []).length;
  const octave = upOctaves - downOctaves;

  // Parse duration as Fraction
  let duration = unitLength.clone();

  // Handle explicit fractions (e.g., '3/2', '2/3') - check this FIRST
  const fracMatch = noteStr.match(/(\d+)\/(\d+)/);
  if (fracMatch) {
    duration = unitLength.multiply(parseInt(fracMatch[1])).divide(parseInt(fracMatch[2]));
  } else {
    // Handle explicit multipliers (e.g., '2', '3')
    const multMatch = noteStr.match(/(\d+)(?!'[/]')/);
    if (multMatch) {
      duration = duration.multiply(parseInt(multMatch[1]));
    }

    // Handle divisions (e.g., '/', '//', '///')
    const divMatch = noteStr.match(/\/+/);
    if (divMatch) {
      const slashes = divMatch[0].length;
      duration = duration.divide(Math.pow(2, slashes));
    }
  }

  return { pitch, octave, duration, isSilence: false };
}

/**
 * Tokenise ABC music notation into individual notes
 * Handles triplets by converting them to fractional durations
 */
function tokeniseABC(abc) {
  const lines = abc.split('\n');
  const musicLines = [];
  let inHeaders = true;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('%')) {continue;}

    if (inHeaders && trimmed.match(/^[A-Z]:/)) {continue;}
    inHeaders = false;
    musicLines.push(trimmed);
  }

  const music = musicLines.join(' ')
    // Handle simple triplets: (3CDE -> C2/3 D2/3 E2/3
    .replace(/\(3:?([A-Ga-g][',]*)([A-Ga-g][',]*)([A-Ga-g][',]*)(?![/0-9])/g, '$12/3$22/3$32/3')
    // Handle triplets with slashes: (3C/D/E/ -> C1/3 D1/3 E1/3
    .replace(/\(3:?([A-Ga-g][',]*)\/([A-Ga-g][',]*)\/([A-Ga-g][',]*)\/(?![/0-9])/g, '$11/3$21/3$31/3')
    // Handle triplets with double length: (3C2D2E2 -> C4/3 D4/3 E4/3
    .replace(/\(3:?([A-Ga-g][',]*)2([A-Ga-g][',]*)2([A-Ga-g][',]*)2(?![/0-9])/g, '$14/3$24/3$34/3');

  // Match notes and rests
  const tokens = music.match(/[=^_]?[A-Ga-gzx][',]*[0-9]*\/?[0-9]*/g) || [];

  return tokens;
}

/**
 * Parse ABC into structured data with bars
 * Returns array of bars, each containing array of note objects
 */
function parseABCWithBars(abc) {
  const unitLength = extractUnitLength(abc);
  const meter = extractMeter(abc);
  const tonalBase = extractTonalBase(abc);

  const lines = abc.split('\n');
  const musicLines = [];
  let inHeaders = true;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('%')) {continue;}
    if (inHeaders && trimmed.match(/^[A-Z]:/)) {continue;}
    inHeaders = false;
    musicLines.push(trimmed);
  }

  const music = musicLines.join(' ')
    .replace(/\(3:?([A-Ga-g][',]*)([A-Ga-g][',]*)([A-Ga-g][',]*)(?![/0-9])/g, '$12/3$22/3$32/3')
    .replace(/\(3:?([A-Ga-g][',]*)\/([A-Ga-g][',]*)\/([A-Ga-g][',]*)\/(?![/0-9])/g, '$11/3$21/3$31/3')
    .replace(/\(3:?([A-Ga-g][',]*)2([A-Ga-g][',]*)2([A-Ga-g][',]*)2(?![/0-9])/g, '$14/3$24/3$34/3');

  // Split by bar lines, keeping the bar line markers
  const barSegments = music.split(/(\|+|\[?\|]?)/);

  const bars = [];
  let currentBar = [];

  for (const segment of barSegments) {
    const trimmed = segment.trim();
    if (!trimmed) {continue;}

    // Check if this is a bar line
    if (trimmed.match(/^\|+$/) || trimmed.match(/^\[?\|]?$/)) {
      if (currentBar.length > 0) {
        bars.push(currentBar);
        currentBar = [];
      }
      continue;
    }

    // Parse notes in this segment
    const matches = segment.matchAll(/([=^_]?[A-Ga-gzx][',]*[0-9]*\/?[0-9]*)(\s?)/g) || [];
    for (const theMatch of matches) {
      const token = theMatch[1];
      const hasFollowingSpace = !!theMatch[2];
      const note = parseNote(token, unitLength);
      if (note) {
        currentBar.push({ ...note, token, hasFollowingSpace });
      }
    }
  }

  // Add final bar if it has content
  if (currentBar.length > 0) {
    bars.push(currentBar);
  }

  return { bars, unitLength, meter, tonalBase };
}

module.exports = {
  extractTonalBase,
  extractMeter,
  extractUnitLength,
  parseNote,
  tokeniseABC,
  parseABCWithBars,
  NOTE_TO_DEGREE
};
