const { Fraction } = require("./math.js");

// ============================================================================
// ABC PARSING UTILITIES
// ============================================================================
//
// SUPPORTED FEATURES (ABC v2.1):
// - Basic note notation (pitch, octave markers, accidentals)
// - Duration modifiers (explicit numbers, fractions, slashes)
// - Rests/silences (z, x)
// - Dummy note: y (for spacing/alignment)
// - Back quotes: ` (ignored spacing for legibility, preserved in metadata)
// - Triplets: (3ABC, (3A/B/C/, (3A2B2C2
// - Repeat notation: |:, :|, |1, |2, etc.
// - Bar lines: |, ||, |], [|, etc.
// - Decorations: symbol decorations (~.MPSTHUV) and !name! decorations
// - Chord symbols: "Dm7", "G", etc.
// - Chords (multiple notes): [CEG], [CEG]2, etc.
// - Annotations: "^text", "<text", etc. (parsed but position markers preserved)
// - Inline fields: [K:...], [L:...], [M:...], [P:...]
// - Inline comments: % comment text
// - Line continuations: \ at end of line
// - Beaming: tracks whitespace between notes for beam grouping
// - Line breaks: preserves information about newlines in music
//
// NOT YET SUPPORTED:
// - Grace notes: {ABC}
// - Slurs and ties: (), -
// - Lyrics: w: lines
// - Multiple voices: V: fields
// - Macros and user-defined symbols
// - MIDI directives
// - Stylesheet directives
// - Many header fields (only X, T, M, L, K extracted)
//
// ============================================================================

// Note degree mapping for chord topmost note detection
const NOTE_TO_DEGREE = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

/**
 * Extract key signature from ABC header
 */
function getTonalBase(abc) {
  const keyMatch = abc.match(/^K:\s*([A-G])/m);
  if (!keyMatch) {
    throw new Error("No key signature found in ABC");
  }
  return keyMatch[1].toUpperCase();
}

/**
 * Extract meter from ABC header
 */
function getMeter(abc) {
  const meterMatch = abc.match(/^M:\s*(\d+)\/(\d+)/m);
  if (meterMatch) {
    return [parseInt(meterMatch[1]), parseInt(meterMatch[2])];
  }
  return [4, 4]; // Default to 4/4
}

/**
 * Extract unit note length as a Fraction object
 */
function getUnitLength(abc) {
  const lengthMatch = abc.match(/^L:\s*(\d+)\/(\d+)/m);
  if (lengthMatch) {
    return new Fraction(parseInt(lengthMatch[1]), parseInt(lengthMatch[2]));
  }
  return new Fraction(1, 8); // Default to 1/8
}

/**
 * Process ABC lines: extract music lines with metadata
 * Handles comments, line continuations, and separates headers from music
 * Preserves newline positions for layout tracking
 *
 * @param {string} abc - ABC notation string
 * @returns {object} - { musicText, lineMetadata, newlinePositions, headerLines, headerEndIndex }
 */
function getMusicLines(abc) {
  const lines = abc.split("\n");
  const musicLines = [];
  const lineMetadata = [];
  const newlinePositions = [];
  const headerLines = [];
  let headerEndIndex = 0;
  let inHeaders = true;
  let currentPos = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let trimmed = line.trim();

    // Skip empty lines and comment-only lines
    if (trimmed === "" || trimmed.startsWith("%")) {
      if (inHeaders) {
        headerEndIndex = i + 1;
      }
      continue;
    }

    // Check for header lines
    if (inHeaders && trimmed.match(/^[A-Z]:/)) {
      headerLines.push(line);
      headerEndIndex = i + 1;
      continue;
    }
    inHeaders = false;

    // Extract inline comment if present
    const commentMatch = trimmed.match(/\s*%(.*)$/);
    const comment = commentMatch ? commentMatch[1].trim() : null;

    // Check for line continuation
    const hasContinuation = trimmed.match(/\\\s*(%|$)/) !== null;

    // Remove inline comments and line continuation marker
    trimmed = trimmed.replace(/\s*%.*$/, "").trim();
    trimmed = trimmed.replace(/\\\s*$/, "").trim();

    if (trimmed) {
      musicLines.push(trimmed);
      lineMetadata.push({
        lineIndex: i,
        originalLine: line,
        content: trimmed,
        comment,
        hasContinuation,
      });

      // Track position where newline would be (unless continuation)
      if (!hasContinuation && musicLines.length > 1) {
        newlinePositions.push(currentPos);
      }

      currentPos += trimmed.length + 1; // +1 for the space we'll add when joining
    }
  }

  return {
    musicText: musicLines.join("\n"),
    lineMetadata,
    newlinePositions,
    headerLines,
    headerEndIndex,
  };
}

// /**
//  * Expand triplet notation into fractional durations
//  * Converts (3ABC -> A2/3 B2/3 C2/3, etc.
//  * Also strips back quotes (`) which are ignored spacing characters
//  *
//  * @param {string} music - Music text
//  * @returns {string} - Music with expanded triplets and stripped back quotes
//  */
// function expandTriplets(music) {
//   return music
//     // Remove back quotes (ignored spacing characters per ABC spec 4.7)
//     .replace(/`/g, '')
//     // Simple triplets: (3CDE -> C2/3 D2/3 E2/3
//     .replace(/\(3:?([A-Ga-g][',]*)([A-Ga-g][',]*)([A-Ga-g][',]*)(?![/0-9])/g, '$12/3$22/3$32/3')
//     // Triplets with slashes: (3C/D/E/ -> C1/3 D1/3 E1/3
//     .replace(/\(3:?([A-Ga-g][',]*)\/([A-Ga-g][',]*)\/([A-Ga-g][',]*)\/(?![/0-9])/g, '$11/3$21/3$31/3')
//     // Triplets with double length: (3C2D2E2 -> C4/3 D4/3 E4/3
//     .replace(/\(3:?([A-Ga-g][',]*)2([A-Ga-g][',]*)2([A-Ga-g][',]*)2(?![/0-9])/g, '$14/3$24/3$34/3');
// }

// /**
//  * condense fractional durations into triplet notation
//  * Converts  A2/3 B2/3 C2/3 -> (3ABC  etc.
//  *
//  * @param {string} music - Music text
//  * @returns {string} - Music with condensed triplets
//  */
// function condenseTriplets(music) {
//   return music
//     // Simple triplets: C2/3D2/3E2/3 -> (3CDE
//     .replace(/([A-Ga-g][',]*)2\/3([A-Ga-g][',]*)2\/3([A-Ga-g][',]*)2\/3/g, '(3$1$2$3')
//     // Triplets with slashes:  C1/3D1/3E1/3 -> (3C/D/E/
//     .replace(/([A-Ga-g][',]*)1\/3([A-Ga-g][',]*)1\/3([A-Ga-g][',]*)1\/3/g, '(3$1/$2/$3/')
//     // Triplets with double length: (3C2D2E2 <- C4/3D4/3E4/3
//     .replace(/([A-Ga-g][',]*)1\/3([A-Ga-g][',]*)1\/3([A-Ga-g][',]*)1\/3/g, '(3$12$22$32')
// }

/**
 * Parse decorations/ornaments from a token
 * Returns array of decoration symbols found
 */
function parseDecorations(noteStr) {
  const decorations = [];

  // Symbol decorations (prefix the note)
  const symbolDecorations = {
    "~": "roll",
    ".": "staccato",
    M: "lowermordent",
    P: "uppermordent",
    S: "segno",
    T: "trill",
    H: "fermata",
    u: "upbow",
    v: "downbow",
  };

  for (const [symbol, name] of Object.entries(symbolDecorations)) {
    if (noteStr.includes(symbol)) {
      decorations.push(name);
    }
  }

  // !decoration! style (can be anywhere in string)
  const bangDecorations = noteStr.match(/!([^!]+)!/g);
  if (bangDecorations) {
    bangDecorations.forEach((dec) => {
      const name = dec.slice(1, -1); // Remove ! marks
      decorations.push(name);
    });
  }

  return decorations.length > 0 ? decorations : null;
}

/**
 * Parse chord symbols from a token
 * Returns chord symbol string or null
 */
function parseChordSymbol(noteStr) {
  const chordMatch = noteStr.match(/"([^"]+)"/);
  return chordMatch ? chordMatch[1] : null;
}

/**
 * Parse annotations from a token
 * Returns annotation text or null
 */
function parseAnnotation(noteStr) {
  // Annotations can be in quotes with position markers like "^text" or "<text"
  const annotationMatch = noteStr.match(/"([<>^_@])([^"]+)"/);
  if (annotationMatch) {
    return {
      position: annotationMatch[1],
      text: annotationMatch[2],
    };
  }
  return null;
}

/**
 * Strip decorations, chords, and annotations from a note string
 * Returns clean note string for duration/pitch parsing
 */
function stripExtras(noteStr) {
  return noteStr
    .replace(/!([^!]+)!/g, "") // Remove !decorations!
    .replace(/"[^"]*"/g, "") // Remove "chords" and "annotations"
    .replace(/[~.MPSTHUV]/g, ""); // Remove symbol decorations
}

/**
 * Analyze whitespace and back quotes after a token
 * Returns object describing the spacing/beaming context
 * Back quotes (`) are ignored for beaming but preserved for reconstruction
 */
function analyzeSpacing(segment, tokenEndPos) {
  if (tokenEndPos >= segment.length) {
    return {
      whitespace: "",
      backquotes: 0,
      beamBreak: false,
      lineBreak: false,
    };
  }

  const remaining = segment.substring(tokenEndPos);

  // Match whitespace and/or back quotes
  const spacingMatch = remaining.match(/^([\s`]+)/);

  if (!spacingMatch) {
    return {
      whitespace: "",
      backquotes: 0,
      beamBreak: false,
      lineBreak: false,
    };
  }

  const fullSpacing = spacingMatch[1];

  // Count back quotes
  const backquotes = (fullSpacing.match(/`/g) || []).length;

  // Extract just whitespace (no back quotes)
  const whitespace = fullSpacing.replace(/`/g, "");

  return {
    whitespace,
    backquotes,
    beamBreak: whitespace.length > 1 || whitespace.includes("\n"), // Multiple spaces or newline breaks beam
    lineBreak: whitespace.includes("\n"),
  };
}

/**
 * Parse ABC note to extract pitch, octave, duration, and metadata
 * For chords in brackets, extracts the topmost note for melody contour analysis
 */
function parseNote(noteStr, unitLength, currentTuple) {
  // Extract metadata before stripping
  const decorations = parseDecorations(noteStr);
  const chordSymbol = parseChordSymbol(noteStr);
  const annotation = parseAnnotation(noteStr);

  // Strip extras for core parsing
  const cleanStr = stripExtras(noteStr);

  // Handle dummy note 'y' (invisible placeholder)
  if (cleanStr.match(/^y$/)) {
    return {
      isDummy: true,
      duration: new Fraction(0, 1, decorations, annotation),
    };
  }

  // Handle chords - extract topmost note for contour sorting
  if (cleanStr.match(/^\[.*\]/)) {
    const chord = parseChord(noteStr, unitLength);
    if (chord && chord.notes && chord.notes.length > 0) {
      // Find topmost note (highest pitch + octave)
      let topNote = chord.notes[0];
      for (const note of chord.notes) {
        if (note.isSilence) {
          continue;
        }
        const topPos =
          (topNote.octave || 0) * 7 +
          (NOTE_TO_DEGREE[topNote.pitch?.toUpperCase()] || 0);
        const notePos =
          (note.octave || 0) * 7 +
          (NOTE_TO_DEGREE[note.pitch?.toUpperCase()] || 0);
        if (notePos > topPos) {
          topNote = note;
        }
      }

      const duration = getDuration({
        unitLength,
        noteString: cleanStr,
        currentTuple,
      });
      topNote.duration = duration;
      // Apply duration to all notes in chord
      chord.notes.forEach((note) => {
        note.duration = duration;
      });
      // Return top note with chord metadata
      return {
        ...topNote,
        isChord: true,
        chordNotes: chord.notes,
        decorations: decorations || chord.decorations,
        chordSymbol: chordSymbol || chord.chordSymbol,
        annotation,
      };
    }
  }

  // Check for rest/silence
  const silenceMatch = cleanStr.match(/^[zx]/);
  if (silenceMatch) {
    const duration = getDuration({
      unitLength,
      noteString: cleanStr,
      currentTuple,
    });
    const result = { isSilence: true, duration, text: silenceMatch[0] };
    if (decorations) {
      result.decorations = decorations;
    }
    if (chordSymbol) {
      result.chordSymbol = chordSymbol;
    }
    if (annotation) {
      result.annotation = annotation;
    }
    return result;
  }

  const { pitch, octave } = getPitch(cleanStr);

  const duration = getDuration({
    unitLength,
    noteString: cleanStr,
    currentTuple,
  });

  const result = { pitch, octave, duration, isSilence: false };
  if (decorations) {
    result.decorations = decorations;
  }
  if (chordSymbol) {
    result.chordSymbol = chordSymbol;
  }
  if (annotation) {
    result.annotation = annotation;
  }
  return result;
}

function getPitch(pitchStr) {
  const pitchMatch = pitchStr.match(/[A-Ga-g]/);
  if (!pitchMatch) {
    return null;
  }

  const pitch = pitchMatch[0];

  // Count octave modifiers
  const upOctaves = (pitchStr.match(/'/g) || []).length;
  const downOctaves = (pitchStr.match(/,/g) || []).length;
  const octave = upOctaves - downOctaves;
  return { pitch, octave };
}

/**
 * Parse a chord (multiple notes in brackets)
 * Returns array of note objects or null
 */
function parseChord(chordStr, unitLength) {
  if (!chordStr.startsWith("[") || !chordStr.endsWith("]")) {
    return null;
  }

  // Split into individual notes
  const noteMatches = chordStr.match(/[=^_]?[A-Ga-g][',]*/g);
  if (!noteMatches) {
    return null;
  }

  const notes = [];
  // const clonedTuple = currentTuple ? {... currentTuple} : undefined
  for (const noteStr of noteMatches) {
    const note = getPitch(noteStr, unitLength);
    if (note) {
      notes.push(note);
    }
  }
  return {
    isChord: true,
    notes,
  };
}

function getDuration({ unitLength, noteString, currentTuple } = {}) {
  // Parse duration as Fraction
  let duration = unitLength.clone();

  // Handle explicit fractions (e.g., '3/2', '2/4', '/4')
  const fracMatch = noteString.match(/(\d+)?\/(\d+)/);
  if (fracMatch) {
    const n = fracMatch[1] ? parseInt(fracMatch[1]) : 1;
    duration = unitLength.multiply(n).divide(parseInt(fracMatch[2]));
  } else {
    // Handle explicit multipliers (e.g., '2', '3')
    const multMatch = noteString.match(/(\d+)(?!'[/]')/);
    if (multMatch) {
      duration = duration.multiply(parseInt(multMatch[1]));
    }

    // Handle divisions (e.g., '/', '//', '///')
    const divMatch = noteString.match(/\/+/);
    if (divMatch) {
      const slashes = divMatch[0].length;
      duration = duration.divide(Math.pow(2, slashes));
    }
  }

  if (currentTuple) {
    duration = duration.divide(currentTuple.p).multiply(currentTuple.q);
    currentTuple.r--;
  }
  return duration;
}

const getTokenRegex = () =>
  /\(\d(?::\d?){0,2}|\[([KLMP]):[^\]]+\]|"[^"]+"|(?:!([^!]+)!\s*)?[~.MPSTHUV]*[=^_]?[A-Ga-gzxy][',]*[0-9]*\/?[0-9]*|!([^!]+)!|[~.MPSTHUV]*\[[^\]]+\][0-9/]*/g;

/**
 * Parse inline field from music section
 * Returns { field, value } or null
 */
function parseInlineField(token) {
  const fieldMatch = token.match(/^\[([KLMP]):\s*(.+)\]$/);
  if (fieldMatch) {
    return {
      field: fieldMatch[1],
      value: fieldMatch[2].trim(),
    };
  }
  return null;
}

/**
 * Parse tuple from music section
 */
function parseTuple(token, isCompoundTimeSignature) {
  const tupleMatch = token.match(/^\(([2-9])(?::(\d)?)?(?::(\d)?)?$/);
  if (tupleMatch) {
    const pqr = {
      p: parseInt(tupleMatch[1]),
      q: tupleMatch[2],
      r: tupleMatch[3],
    };
    const { p } = pqr;
    let { q, r } = pqr;
    if (q) {
      q = parseInt(q);
    } else {
      switch (p) {
        case 2:
          q = 3;
          break;
        case 3:
          q = 2;
          break;
        case 4:
          q = 3;
          break;
        case 5:
        case 7:
        case 9:
          q = isCompoundTimeSignature ? 3 : 2;
          break;
        case 6:
          q = 2;
          break;
        case 8:
          q = 3;
          break;
      }
    }
    if (r) {
      r = parseInt(r);
    } else {
      r = p;
    }
    return {
      isTuple: true,
      p,
      q,
      r,
    };
  }
  return null;
}

/**
 * Classify bar line type
 * Returns object with type classification and properties
 */
function classifyBarLine(barLineStr) {
  const trimmed = barLineStr.trim();

  // Repeat endings
  if (trimmed.match(/^\|[1-6]$/)) {
    return {
      type: "repeat-ending",
      ending: parseInt(trimmed[1]),
      text: barLineStr,
      isRepeat: true,
    };
  }

  // Start repeat
  if (trimmed.match(/^\|:/) || trimmed.match(/^\[\|/)) {
    return {
      type: "repeat-start",
      text: barLineStr,
      isRepeat: true,
    };
  }

  // End repeat
  if (
    trimmed.match(/^:\|/) ||
    (trimmed.match(/^\|\]/) && !trimmed.match(/^\|\]$/))
  ) {
    return {
      type: "repeat-end",
      text: barLineStr,
      isRepeat: true,
    };
  }

  // Double repeat
  if (
    trimmed.match(/^::/) ||
    trimmed.match(/^:\|:/) ||
    trimmed.match(/^::\|:?/) ||
    trimmed.match(/^::\|\|:?/)
  ) {
    return {
      type: "repeat-both",
      text: barLineStr,
      isRepeat: true,
    };
  }

  // Final bar
  if (trimmed === "|]") {
    return {
      type: "final",
      text: barLineStr,
      isRepeat: false,
    };
  }

  // Double bar
  if (trimmed === "||") {
    return {
      type: "double",
      text: barLineStr,
      isRepeat: false,
    };
  }

  // Regular bar
  if (trimmed === "|") {
    return {
      type: "regular",
      text: barLineStr,
      isRepeat: false,
    };
  }

  // Unknown/complex bar line
  return {
    type: "other",
    text: barLineStr,
    isRepeat: trimmed.includes(":"),
  };
}

/**
 * Parse ABC into structured data with bars
 *
 * Returns object with:
 * {
 *   bars: Array<Array<NoteObject>>,  // Array of bars, each bar is array of notes/chords/fields
 *   unitLength: Fraction,             // The L: field value (default 1/8)
 *   meter: [number, number],          // The M: field value (default [4,4])
 *   tonalBase: string,                // The tonic from K: field (e.g., 'D', 'G')
 *   lineMetadata: Array<LineMetadata> // Info about original lines (comments, continuations)
 * }
 *
 * NoteObject structure (regular note):
 * {
 *   pitch: string,              // 'A'-'G' (uppercase for low octave, lowercase for middle)
 *   octave: number,             // Relative octave offset (0 = middle, +1 = high, -1 = low)
 *   duration: Fraction,         // Note duration as fraction of whole note
 *   isSilence: false,           // Always false for pitched notes
 *   token: string,              // Original ABC token (e.g., 'D2', '^F/')
 *   spacing: {                  // Whitespace/beaming info after this token
 *     whitespace: string,       // Actual whitespace characters (back quotes removed)
 *     backquotes: number,       // Number of ` characters for reconstruction
 *     beamBreak: boolean,       // True if beam should break (multiple spaces/newline)
 *     lineBreak: boolean        // True if there was a newline after this token
 *   },
 *
 *   // Optional properties (only present if applicable):
 *   decorations: Array<string>, // e.g., ['trill', 'staccato']
 *   chordSymbol: string,        // e.g., 'Dm7', 'G'
 *   annotation: {               // Text annotation with position
 *     position: string,         // '^' (above), '_' (below), '<' (left), '>' (right), '@' (auto)
 *     text: string
 *   },
 *   isChord: true,              // Present if this is a chord [CEG]
 *   chordNotes: Array<NoteObject> // All notes in the chord (when isChord=true)
 * }
 *
 * NoteObject structure (silence/rest):
 * {
 *   isSilence: true,
 *   duration: Fraction,
 *   token: string,
 *   spacing: { ... },           // Same as regular note
 *   // Optional: decorations, chordSymbol, annotation (same as above)
 * }
 *
 * NoteObject structure (dummy note):
 * {
 *   isDummy: true,
 *   duration: Fraction,
 *   token: string,
 *   spacing: { ... }
 * }
 *
 * NoteObject structure (inline field change):
 * {
 *   isInlineField: true,
 *   field: string,              // 'K', 'L', 'M', or 'P'
 *   value: string,              // The field value (e.g., 'G major', '3/4')
 *   token: string               // Original token (e.g., '[K:G]')
 *   spacing: { ... }
 * }
 *
 * NoteObject structure (standalone chord symbol):
 * {
 *   isChordSymbol: true,
 *   chordSymbol: string,        // The chord name
 *   token: string,
 *   spacing: { ... }
 * }
 *
 * LineMetadata structure:
 * {
 *   originalLine: string,       // Complete original line from ABC
 *   comment: string | null,     // Text after % (null if no comment)
 *   hasContinuation: boolean    // Whether line had \ continuation marker
 * }
 *
 * @param {string} abc - ABC notation string
 * @param {object} options - Parsing options
 * @param {number} options.maxBars - Maximum number of bars to parse (optional)
 * @returns {object} - Parsed structure as described above
 *
 * Example:
 *   parseABCWithBars('X:1\nL:1/4\nK:D\n"Dm"D2 [DF]A | ~B4 |]')
 *   // Returns:
 *   {
 *     bars: [
 *       [
 *         { isChordSymbol: true, chordSymbol: 'Dm', spacing: {...}, ... },
 *         { pitch: 'D', octave: 0, duration: Fraction(1,2), chordSymbol: 'Dm', spacing: {...}, ... },
 *         { pitch: 'F', octave: 0, duration: Fraction(1,4), isChord: true, chordNotes: [...], spacing: {...}, ... },
 *         { pitch: 'A', octave: 0, duration: Fraction(1,4), spacing: {...}, ... }
 *       ],
 *       [
 *         { pitch: 'B', octave: 0, duration: Fraction(1,1), decorations: ['roll'], spacing: {...}, ... }
 *       ]
 *     ],
 *     unitLength: Fraction(1,4),
 *     meter: [4,4],
 *     tonalBase: 'D',
 *     lineMetadata: [...]
 *   }
 */
function parseABCWithBars(abc, options = {}) {
  const { maxBars = Infinity } = options;

  let unitLength = getUnitLength(abc);
  let meter = getMeter(abc);
  let tonalBase = getTonalBase(abc);

  const {
    musicText,
    lineMetadata,
    headerLines,
    headerEndIndex,
    newlinePositions,
  } = getMusicLines(abc);

  // Create a Set of newline positions for O(1) lookup
  const newlineSet = new Set(newlinePositions);

  // Comprehensive bar line regex - includes trailing spaces
  const barLineRegex = /(\|\]|\[\||(\|:?)|(:?\|)|::|(\|[1-6])) */g;

  const bars = [];
  const barLines = [];
  let currentBar = [];
  let barCount = 0;

  // Split music text by bar lines while preserving positions
  let lastBarPos = 0;
  let match;
  let first = true;

  while ((match = barLineRegex.exec(musicText)) !== null || first) {
    first = false;
    const { barLineText, barLinePos } =
      match === null
        ? { barLineText: musicText, barLinePos: musicText.length }
        : {
            barLineText: match[0],
            barLinePos: match.index,
          };

    // Process segment before this bar line
    const segment = musicText.substring(lastBarPos, barLinePos);

    if (segment.trim()) {
      // Parse tokens in this segment
      // Match: inline fields, chord symbols, chords in brackets, decorations, notes/rests/dummy
      const tokenRegex = getTokenRegex();

      let tokenMatch;
      // let segmentPos = lastBarPos;

      let currentTuple = null;

      while ((tokenMatch = tokenRegex.exec(segment)) !== null) {
        //check if all notes of the tuple have been parsed
        if (currentTuple && currentTuple.r === 0) {
          currentTuple = null;
        }
        const fullToken = tokenMatch[0];
        const tokenStartPos = lastBarPos + tokenMatch.index;
        // const tokenEndPos = tokenStartPos + fullToken.length;
        const spacing = analyzeSpacing(
          segment,
          tokenMatch.index + fullToken.length
        );

        // Check for inline field
        const inlineField = parseInlineField(fullToken);
        if (inlineField) {
          // Update context based on inline field
          if (inlineField.field === "L") {
            const lengthMatch = inlineField.value.match(/1\/(\d+)/);
            if (lengthMatch) {
              unitLength = new Fraction(1, parseInt(lengthMatch[1]));
            }
          } else if (inlineField.field === "M") {
            const meterMatch = inlineField.value.match(/(\d+)\/(\d+)/);
            if (meterMatch) {
              meter = [parseInt(meterMatch[1]), parseInt(meterMatch[2])];
            }
          } else if (inlineField.field === "K") {
            const keyMatch = inlineField.value.match(/^([A-G])/);
            if (keyMatch) {
              tonalBase = keyMatch[1].toUpperCase();
            }
          }

          currentBar.push({
            isInlineField: true,
            field: inlineField.field,
            value: inlineField.value,
            token: fullToken,
            sourceIndex: tokenStartPos,
            sourceLength: fullToken.length,
            spacing,
          });
          continue;
        }

        // tuples
        if (fullToken.match(/\(\d(?::\d?){0,2}/g)) {
          const tuple = parseTuple(fullToken);
          if (tuple) {
            if (currentTuple) {
              throw new Error("nested tuples not handled");
            }
            // Update context based on inline field
            currentTuple = tuple;
            currentBar.push({
              ...tuple,
              token: fullToken,
              sourceIndex: tokenStartPos,
              sourceLength: fullToken.length,
            });
            continue;
          }
        }

        // Standalone chord symbol
        if (fullToken.match(/^"[^"]+"$/)) {
          currentBar.push({
            isChordSymbol: true,
            chordSymbol: fullToken.slice(1, -1),
            token: fullToken,
            sourceIndex: tokenStartPos,
            sourceLength: fullToken.length,
            spacing,
          });
          continue;
        }

        // Standalone decoration
        if (fullToken.match(/^!([^!]+)!$/)) {
          currentBar.push({
            isDecoration: true,
            decoration: fullToken.slice(1, -1),
            token: fullToken,
            sourceIndex: tokenStartPos,
            sourceLength: fullToken.length,
            spacing,
          });
          continue;
        }

        // Regular note, rest, or dummy, or chord in brackets
        const note = parseNote(fullToken, unitLength, currentTuple);
        if (note) {
          currentBar.push({
            ...note,
            token: fullToken,
            sourceIndex: tokenStartPos,
            sourceLength: fullToken.length,
            spacing,
          });
        }
      }
    }

    // Check if bar line has a newline after it
    const barLineEndPos = barLinePos + barLineText.length;
    const hasLineBreakAfterBar =
      newlineSet.has(barLineEndPos + 1) ||
      (barLineEndPos < musicText.length && musicText[barLineEndPos] === "\n");

    // Store bar line information
    const barLineInfo = classifyBarLine(barLineText);
    barLines.push({
      ...barLineInfo,
      sourceIndex: barLinePos,
      sourceLength: barLineText.length,
      barNumber: barCount,
      hasLineBreak: hasLineBreakAfterBar,
    });

    // Update the last token in current bar to mark lineBreak if bar line has one
    if (currentBar.length > 0 && hasLineBreakAfterBar) {
      const lastToken = currentBar[currentBar.length - 1];
      if (lastToken.spacing) {
        lastToken.spacing.lineBreak = true;
      }
    }

    // Save current bar if it has content
    if (currentBar.length > 0) {
      bars.push(currentBar);
      barCount++;
      currentBar = [];

      // Check if we've reached max bars
      if (barCount >= maxBars) {
        break;
      }
    }

    lastBarPos = barLineEndPos;
  }

  // Add final bar if it has content and we haven't reached max
  if (currentBar.length > 0 && barCount < maxBars) {
    bars.push(currentBar);
  }

  return {
    bars,
    barLines,
    unitLength,
    meter,
    tonalBase,
    lineMetadata,
    headerLines,
    headerEndIndex,
    musicText,
  };
}

/**
 * Calculate bar durations from parsed ABC data
 * Returns duration for each bar
 */
function calculateBarDurations(parsedData) {
  const { bars } = parsedData;

  return bars.map((bar) => {
    let total = new Fraction(0, 1);
    for (const note of bar) {
      if (!note.duration) {
        continue;
      }
      total = total.add(note.duration);
    }
    return total;
  });
}

module.exports = {
  getTonalBase,
  getMeter,
  getUnitLength,
  getMusicLines,
  analyzeSpacing,
  parseABCWithBars,
  classifyBarLine,
  calculateBarDurations,
  NOTE_TO_DEGREE,
};
