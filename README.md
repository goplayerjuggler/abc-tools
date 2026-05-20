# abc-tools
A JavaScript library with utility functions for tunes written in ABC format. Particularly applicable to Irish, and other, traditional music.

# features
* ABC ([v2.1](https://abcnotation.com/wiki/abc:standard:v2.1)) parsing – a partial implementation.
* multi-level sorting of a list of tunes, with a *contour sort* algorithm.  
  The algorithm used for sorting is new/original, as far as I know, and is described [here](./docs/contour_sort.md). 
* contours are independent of key and mode. 
* contour visualisations as SVGs.
* Extracting initial bars and incipits.
* Doubling/halving bar length - e.g. going from 4/4 to 4/2 and vice versa.

This is work in progress; I'm aware of a few small bugs and there are probably many others.

# where is it used
AFAIK at present this is only used by one other repo; a project of mine, [tuneTable](https://github.com/goplayerjuggler/tuneTable), which builds on this repo. There’s a [live demo](https://goplayerjuggler.github.io/tuneTable) featuring the contour sort - the default list is sorted first by rhythm, then by contour, then by name.

# AI
A lot of the implementation was done with the help of AI, notably with Anthropic’s Claude.ai / Sonnet 4.6.

## license

This project is licensed under the [GNU General Public License v3.0](LICENSE).

This means you are free to use, modify, and distribute this software, but any derivative works must also be distributed under the GPL-3.0 license. See the [LICENSE](LICENSE) file for full details.

## installation

```
npm i @goplayerjuggler/abc-tools
```

## contributing

Issues and pull requests welcome at https://github.com/goplayerjuggler/abc-tools

