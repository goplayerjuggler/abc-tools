# abc-tools

A JavaScript library mainly for sorting melodies by their modal contour, independent of key and mode. Designed for ABC notation tunes, particularly Irish traditional music.
There may be other tools added too.

## Installation

```
npm install tune-contour-sort
```

## Usage / sorting

```javascript
const { getSortObject, sort, sortArray } = require('tune-contour-sort');

// Get sort object for a single tune
const abc = `X:1
L:1/8
K:G
GBG AGA`;

const sortObj = getSortObject(abc);
console.log(sortObj);


// Compare two tunes
const tune1 = getSortObject(abc1);
const tune2 = getSortObject(abc2);
const comparison = sort(tune1, tune2);
// Returns: -1 (tune1 < tune2), 0 (equal), or 1 (tune1 > tune2)

// Sort an array of tunes
const tunes = [
  { title: 'Tune A', abc: '...' },
  { title: 'Tune B', abc: '...' },
  { title: 'Tune C', abc: '...' }
];

const sorted = sortArray(tunes);
```
## API /sorting

### `getSortObject(abc)`

Generates a sort object from ABC notation.

**Parameters:**
- `abc` (string): ABC notation string with headers (K:, L:, etc.)

**Returns:** Object with:
- `sortKey` (string): Hexadecimal encoding of the modal contour
- `rhythmicDivisions` (array, optional): Information about subdivided notes
- `version` (string): Algorithm version
- `part` (string): Tune part (default 'A')

### `sort(sortObjA, sortObjB)`

Compares two sort objects.

**Parameters:**
- `sortObjA` (object): First sort object
- `sortObjB` (object): Second sort object

**Returns:** Number
- `-1` if A sorts before B
- `0` if equal
- `1` if A sorts after B

### `sortArray(tuneArray)`

Sorts an array of tune objects.

**Parameters:**
- `tuneArray` (array): Array of objects with `abc` property

**Returns:** Sorted array (with `sortObject` added to each item)

## Contributing

Issues and pull requests welcome at https://github.com/goplayerjuggler/abc-tools

## References

Based on the modal contour sorting algorithm described in the project documentation, similar to but distinct from Jianpu (numbered musical notation) sorting systems.
