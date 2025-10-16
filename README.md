# abc-tools

A JavaScript library mainly for sorting melodies by their modal contour, independent of key and mode. Designed for ABC notation tunes, particularly Irish traditional music.
There may be other tools added too, later on.

The algorithm used for sorting is new/original, as far as I know, and is described [here](./docs/contour_sort.md)

The writing of the algorithm,  implementation, and project setup were done with the help of Claude.ai and github copilot.

## installation

```
npm install tune-contour-sort
```

## usage / sorting

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
## API / sorting

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


## license

This project is licensed under the [GNU General Public License v3.0](LICENSE).

This means you are free to use, modify, and distribute this software, but any derivative works must also be distributed under the GPL-3.0 license. See the [LICENSE](LICENSE) file for full details.


## contributing

Issues and pull requests welcome at https://github.com/goplayerjuggler/abc-tools

## references

Based on the [modal contour sorting algorithm](./docs/contour_sort.md) described in the project documentation; similar to but distinct from Jianpu (numbered musical notation) sorting systems.
