# Melody modal contour sorting algorithm - “contour sort for tunes”

## Overview

A system for sorting or indexing tunes or melodies. Key and mode agnostic. It takes short phrases, or parts of modal melodies, and sorts or indexes them by their contour within their modal scale, independent of key. So tunes may be in different keys, or modes, but will get sorted together if they have the same modal contour.

Typically the algorithm will apply to sort tunes based on their incipit (opening phrase), but for tunes with multiple parts/sections, it could also be applied to the incipits of the other sections.

Sometimes the same tune can be played differently; so a single tune can be represented by N different incipits. In that case this sort algorithm could be used to place the same tune N times in a list.

A noteworthy general feature is that held notes are sorted before the repeated notes, when they are in the same position in the tone contour - details below.

This system resembles the sort system used for [Jianpu](https://en.wikipedia.org/wiki/Jianpu) (numbered musical notation used in China and elsewhere), but with a key difference: Jianpu sorting is mode-specific (usually major scale) and modern Jianpu also specifies the key; this sorting algorithm abstracts away the key and the mode.

## Scope

This system is applicable to single-voice melodies in a modal system, where there is a regular beat and a pulse, and a common subdivision of the beat. Examples: reels, jigs and other tune types in Irish traditional music. In both cases the common subdivision is a quaver (aka an eighth note).

So for instance this system can compare any two reels, whatever their key and mode.
### A few practical considerations
#### Like with like
It makes sense to compare two reels using this system; less so to compare a reel with a jig. However, comparing jigs and slides with each other makes sense – both can be written using triplets.
#### Anacrucis
Tunes may have an anacrucis, aka a pickup. This is a short phrase at the beginning of the tune whose length (duration) is less than the length of a full bar. 
As the length of the anacrucis can vary, and often there is no anacrucis at all, it seems reasonable to **ignore the anacrucis** when comparing tunes.
#### Chords
Sometimes tunes may be written with chords (i.e. more than one note head on a single stem). When this happens, the algorithm only takes the topmost note (the note of the highest pitch) and ignores the others.

## Musical implications

**Modal neutrality:** A melody that goes 1-3-5 will sort the same whether in G major, D dorian, or A mixolydian.

**Key neutrality:** Transposing a tune to a different key doesn't change its sort position relative to other tunes in their respective keys.

**Melodic clustering:** Tunes with similar opening gestures naturally group together:
- Tunes leaping to the fifth
- Tunes with stepwise motion
- Tunes with specific rhythmic-melodic patterns

## Extensions

**Multiple incipits (aliases)**: A tune with N different ways of playing its opening can appear N times in a sorted list, once for each different incipit. This accounts for regional variations and different performance practices.

**Multi-part tunes**: For tunes with multiple sections (A part, B part, etc.), each section's incipit can be encoded separately. This allows for:
- Sorting by primary part (usually A part)
- Secondary sorting by subsequent parts
- Finding tunes with similar B parts but different A parts

**Partial matching**: The encoding scheme allows for finding tunes that share a common opening of any length, not just exact matches.

# Detailed description of the algorithm
## Outline
This algorithm is similar to the standard lexicographic sorting algorithm, but the items to be sorted can be modified as part of the process.

Identify the tonic ("home" of the mode) in the primary octave of the tune. Each note of the tune will either be a pause (or silence), or be in a specific degree of the modal scale, a specific octave, and will have a duration that can be expressed in terms of the **common subdivision of the beat (CSB)**. (For a given tune type, like a reel, the CSB is the note length commonly used to write most notes. In ABC format, it can be identified with the `L:` header. It's commonly a quaver (aka an eighth note), but some may prefer using semiquavers instead.)

We consider two types of notes: **played** notes and **held** notes. *Held* notes are held over from the preceding note of the same modal degree and octave. So a crotchet (aka a quarter note) can be considered as one played quaver followed by one held quaver.


## Modal contour
We start by rewriting the tune so each note's duration is at most one CSB, in order to enforce a rule:

**Duration rule**: each duration is either 1 CSB, or is shorter than one CSB. 

Durations shorter than one CSB have fractional duration:
- it is measured as a fraction n/d where 0 < n < d
- Commonly seen denominators (`d`): 2 (sixteenth notes), 3 (triplets), 4 (thirty-second notes)

**Normalisation of note durations**: Notes longer than one CSB are split into multiple notes, in a simple “greedy” way:
- The first one is a **played** note, with a duration as long as possible (max 1 CSB)
- Subsequent notes are **held** notes (continuations of the same pitch), also with durations as long as possible (max 1 CSB).

**Special case for pauses or silences**: the played/held distinction is not made. (A silence is a silence…)

- Examples: 
    A note of duration 2 CSBs becomes: [played note] [held note], each of duration one CSB.
    A note of duration 2.5 CSBs becomes: [played note, duration 1 CSB] [held note, duration 1 CSB] [held note, duration 0.5 CSB].
For each note in the tune, record the following:
1. **Modal degree** - position relative to the tonic (1st, 2nd, 3rd degree, etc.) Ignore accidentals; for the purpose of this algorithm, a 3rd degree with a flat or a sharp is treated just the same as a 3rd without an accidental.
2. **Octave** - which octave the note is in; assuming that there is a primary octave or middle octave for the tune, the octave is an integer ranging from -2 to 2; and usually ranging from -1 to 1.
3. **How the note is played** (H) - whether the note is **played** or is **held** over from the previously played note, or (third option) is **silence** - nothing is played - there is a musical pause during the note's duration.
4. **Duration** - explained above

The list of all these pieces of information is called the tune's **modal contour** (MC), or simply its **contour**.

Items 1-4 are called the **note information** (NI).

Items 1-3, without item 4, is called the note's **modal degree information** (MDI), or simply its **degree information**.

## Comparison of contours

Two contours `A` and `B` are compared by the following algorithm. Say `a` is the first NI of `A` and `b` is the first NI of `B`.

1. **If `a` and `b` are of the same duration:**
    - If one is **silent** but not the other, then the silent one goes first
    - Else if they are not in the same octave, then the one with the lower octave goes first
    - Else if they are not in the same modal degree, then one with the lower degree goes first
    - Else (same octave and degree) if one is held and one is played, then one that is held goes first. (**rule putting held notes before repeated notes**)
    - Else (same MDI) get new tunes `A'` and `B'` by removing `a` from `A` and `b` from `B`. 
        - If one or both of `A'`, `B'` are empty, then stop - the tunes that is not empty goes after the empty one; and if both are empty then they are sorted together. 
         - Else apply the sort algorithm to `A'` and `B'`.

2. **Else `a` and `b` are not of the same duration:**
    
    Say `a` has duration x and `b` has duration y, where x < y. Both durations are expressed as fractions of the CSB.
    
    - Create new tunes A' and B' by:
        - Replacing `b` in B with two notes: `b1` of duration x, and `b2` of duration (y - x)
        - Where `b1` has the same MDI as `b` (but duration x)
        - And `b2` is a **held** note with the same pitch as `b` (and duration y - x)
        - A' remains the same as A
    
    - Now apply the comparison algorithm to A' and B', noting that their first notes now have the same duration x.
    
    **Example**: Comparing a tune starting with a note of duration 1/2 against a tune starting with a note of duration 2/3:
    - Split the 2/3 duration note into: one note of duration 1/2 (played) + one note of duration 1/6 (held)
    - Now compare the 1/2 duration notes directly
    - Then continue with the remainders

## A few short examples 
The following examples show the results of the algorithm when it encounters notes to be compared that have different durations.  
Assume each example is K:Cmajor, L:1/8, R:4/4 (ABC headers). That means the CSB is one eighth note. See the section [understanding ABC format](#understanding-ABC-format) below for more details.


1. **Held vs repeated**: If tune T1 starts with `c2` (a quarter note), and tune T2 starts with `cc` (two eighth notes), then T1 < T2 (held sorts before repeated). This is because `c2` will be rewritten as `c c(held)`

2. **Subdivisions - 1**: If T3 starts with `c/d/c` (two sixteenth notes and an eighth note) then T2 < T3. Because T2 gets converted to `c/ c(held)/ c` and then after discarding the first note in T2 and T3, the next notes that are compare are `c(held)/` for T2 and `d/` for .

3. **Subdivisions - 2**: For T4 = `c/B/c` we have T4 < T2 (lower pitch B sorts before higher pitch c). It works similarly to the previous example.
4. **triplets**
**Triplet notation in ABC**: `(3CDE` represents three notes played in the time of two eighth notes. Each note has duration 2/3 of an eighth note.


- Tune A: `K:C\nL:1/8\nC/D/E F` (three sixteenth notes followed by an eighth note)
- Tune B: `K:C\nL:1/8\n(3CDE F` (triplet followed by an eighth note)

**Comparison**:
- Both start with C, but different durations (1/2 vs 2/3 of CSB)
- expand the first note of tune B to a played C, duration 1/2 followed by a held C of duration 1/6 (2/3-1/2 = 1/6). Now comparing the second notes, the D in Tune A is higher than the held C in tune B; so tune B goes first; `Tune B < Tune A`.

# Implementation / data structure proposal

Tunes are input in ABC format. Sorting to be carried out in a Javascript/ES context.
It can be useful to save some intermediate data structures to optimise sorting of a list.

This implementation represents the modal contour with two objects: the first giving all the MDIs encoded as a string, and is called the **sort key**; and the second giving the indexes of items where the duration is less than one CSB, along with the actual duration, called the **durations**.
```javascript
//data structure for tune B in example 4 above
{
    sortKey:"...",
    durations:[{i:0,n:2,d:3},{i:1,n:2,d:3}]
}
```
## durations array format

Each entry represents a note whose duration is less than one CSB:
- `i`: index position in the sortKey
- `n`: numerator of duration fraction
- `d`: denominator of duration fraction
- **important**: n/d represents the duration as a **fraction of the CSB**

Examples (assuming L:1/8, so CSB = 1/8):
- sixteenth note: duration = 1/2 CSB → {i: 0, n: 1, d: 2}
- triplet eighth: duration = 2/3 CSB → {i: 0, n: 2, d: 3}
- thirty-second: duration = 1/4 CSB → {i: 0, n: 1, d: 4}

If the property `n` is omitted, then take `n=1`; it defaults to 1.


## understanding ABC format
Understanding ABC pitch notation:
Low to high, here are the notes that are commonly seen on treble clefs.
`.. G, A, B, C D E F G A B c d e f g a b c' d' ...`
`C` represents “middle C”.
Note that this is case-sensitive; and `,` (comma) represents down one octave, and `'` represents up one octave.  
Full specs are available [here](https://abcnotation.com/wiki/abc:standard:v2.1).

## Determining the primary octave

The home note depends on the tonal base, aka the tonic, of the tune's key signature, not the mode. And the primary octave is the one following the home note.
The tonal base (ignoring sharps and flats) is the first non-whitespace letter following `K:` in the ABC header.
For the moment we will apply the following heuristic: the home note, written in ABC, is simply the (upper case) letter for the tonal base.
This also applies to key signatures where the tonal base is a sharpened or flattened note, like F sharp or D flat. The sharps and flats can be ignored.

It may be necessary in the future to apply a different heuristic where we add/subtract octaves in order to maximise the number of notes of the tune that are in the primary octave.


## Encoding scheme

The encoding uses Unicode characters to represent each note's MDI. The implementation uses a base character (configurable in the code) and encodes:

**For each note position:**
- Position = (octave + 2) × 7 + scale_degree
- Character code = base_char + (position × 2) + played_flag
- Where played_flag = 1 for played notes, 0 for held notes

This ensures:
- Each unique pitch/octave combination has two consecutive character codes
- Held notes (even codes) sort before played notes (odd codes)
- Higher pitches have higher character codes

**Silences** are encoded with a single character, configurable, at least 40 code points lower than then the base character.

**Current choices** are:
 - base character: 0x0420 (towards the middle of the Cyrillic characters)
 - *Silence* is represented by `_`.

### Basic note encoding example

Using base_char = 0x0041 (ASCII 'A') for illustration:

- **Tonic in primary octave (played)** = character at position (2×7+0)×2+1 = code 0x0041 + 29 = 'N'
- **Tonic in primary octave (held)** = character at position (2×7+0)×2+0 = code 0x0041 + 28 = 'M'
- **Second degree (played)** = character at position (2×7+1)×2+1 = code 0x0041 + 31 = 'P'
- **Each scale degree up** = +2 in character code
- **Each octave up** = +14 in character code (7 degrees × 2)


## Data structure

A sort object is generated for each tune:
```javascript
{
  sortKey: 'NPNNMNONM',              // string encoding the MDIs
  durations: [                    // optional, only if durations < 1 CSB
    { i: 0, n:2, d: 3 },
    { i: 1, n:2, d: 3 },
    { i: 2, n:2, d: 3 },
    // notes at positions 0,1,2 have duration 2/3
    
    { i: 7, d: 2 },
    { i: 8, d: 2 },
    // notes at positions 0,1,2 have duration 1/2 - if n is omitted, take n=1.
  ],
  version: '1.0',                 // algorithm version
  part: 'A'                       // the part of the tune (A, B, C, etc.)
}
```

**Divisor meanings:**
- 2 = note halved (e.g., sixteenth in an eighth-note context)
- 3 = triplet division
- 4 = note quartered (e.g., thirty-second in an eighth-note context)
- etc

## Comparison algorithm

When comparing two tunes:

1. **Compare base sort strings** lexicographically until they differ or one needs expansion (different durations, as specified by `rhythmicDivisions`)

2. **If rhythmic divisions differ at a position:** apply the algorithm above for **expanding** where necessary, using the held-note rule

## Examples with incipits of real tunes – a jig and two reels

**Tune in G major:**
- ABC:
```
X:1
T: The Munster
R: jig
L:1/8
M:12/8
K:G major
G2B AGA B2d gdB
```
- Sort object (conceptual, actual characters depend on base_char):
  - G held (tonic): [played G][held G]
  - B (3rd degree): [played B]
  - A (2nd degree): [played A]
  - G (tonic): [played G]
  - A (2nd degree): [played A]
  - B held (3rd degree): [played B][held B]
  - d (5th degree): [played d]
  - g (tonic, octave up): [played g]
  - d (5th degree): [played d]
  - B (3rd degree): [played B]

**Tune in D mixolydian:**
- ABC:
```
X:1
T: The Colliers’
R: reel
L:1/8
M:4/2
K:D mixo
FDE/F/G A2AB cAdB cAG2 |
```
- Sort key:
  - F (3rd degree): [played F]
  - D (tonic): [played D]
  - E/F/ (2nd and 3rd degree, subdivided): [played E][played F]
  - G (4th degree): [played G]
  - A held (5th degree): [played A][held A]
  - A (5th degree): [played A]
  - B (6th degree): [played B]
  - ...
  - durations: [{i: 2, d: 2}, {i: 3, d: 2}]

**Tune in G major with comparison:**
- ABC:
```
X: 12
T: The Flogging
R: reel
M: 4/2
L: 1/8
K: Gmaj
BGGA BGdG BGGA Bdgd|
```
- Sort object starts with: [played B][played G][played G][played A]...

**Comparison**: The Flogging < The Colliers
- Both are reels, so comparable
- First notes: B (3rd in G) vs F (3rd in D) - same relative degree
- Second notes: G (tonic in G) vs D (tonic in D) - same relative degree
- Third notes: G (tonic) vs E (2nd degree) - tonic < 2nd degree
- Result: The Flogging sorts first
