# abc-tools

A JavaScript library with utility functions for tunes written in ABC format. Particularly applicable to Irish, and other, traditional music.
# features
* contour sort algorithm
Sorts tunes by their contour, independent of key and mode. 
The algorithm used for sorting is new/original, as far as I know, and is described [here](./docs/contour_sort.md) 
* Extracting initial bars and incipits
* Doubling/halving bar length - e.g. going from 4/4 to 4/2 and vice versa
  This is work in progress; still quite buggy.

# about this project
Writing up the sort algorithm, its implementation along with implementation of other features, and the project setup, were all done with the help of Claude.ai and github copilot.

## license

This project is licensed under the [GNU General Public License v3.0](LICENSE).

This means you are free to use, modify, and distribute this software, but any derivative works must also be distributed under the GPL-3.0 license. See the [LICENSE](LICENSE) file for full details.

## installation

```
npm i @goplayerjuggler/abc-tools
```


## contributing

Issues and pull requests welcome at https://github.com/goplayerjuggler/abc-tools

