const {
  getFirstBars,
  toggleMeter_4_4_to_4_2,
  toggleMeter_6_8_to_12_8,
  // hornpipeToSwing
} = require('../src/index.js');

// ============================================================================
// TEST EXAMPLES
// ============================================================================

// Example 1: Get first bar (ignoring anacrusis)
const tuneWithAnacrusis = `X:1
T:Example Tune
M:4/4
L:1/8
K:D
FA | d2 cB A2 FA | d2 f2 e2 d2 |`;

console.log('=== Example 1: Get First Bar ===');
console.log('Original:');
console.log(tuneWithAnacrusis);
console.log('\nFirst bar (ignoring anacrusis):');
try {
  const firstBar = getFirstBars(tuneWithAnacrusis, 1);
  console.log(firstBar);
} catch (err) {
  console.error('Error:', err.message);
}

// Example 2: Get first two bars
console.log('\n=== Example 2: Get First Two Bars ===');
try {
  const firstTwoBars = getFirstBars(tuneWithAnacrusis, 2);
  console.log(firstTwoBars);
} catch (err) {
  console.error('Error:', err.message);
}

// Example 3: Toggle M:4/4 to M:4/2
const tune_4_4 = `X:1
T:Example in 4/4
M:4/4
L:1/8
K:D
D2 FA dA FD | G2 Bc d2 cB |
A2 AB c2 BA | G2 FE D4 |]`;

console.log('\n=== Example 3: Toggle M:4/4 to M:4/2 ===');
console.log('Original (M:4/4):');
console.log(tune_4_4);
console.log('\nConverted to M:4/2:');
try {
  const converted = toggleMeter_4_4_to_4_2(tune_4_4);
  console.log(converted);
  console.log('\nConverted back to M:4/4:');
  const convertedBack = toggleMeter_4_2_to_4_4(converted);
  console.log(convertedBack);
} catch (err) {
  console.error('Error:', err.message);
}

// Example 4: Toggle M:6/8 to M:12/8
const tune_6_8 = `X:1
T:Example in 6/8
M:6/8
L:1/8
K:D
DFA dAF | GBd gdB |
AFD DFA | G2E E3 |]`;

console.log('\n=== Example 4: Toggle M:6/8 to M:12/8 ===');
console.log('Original (M:6/8):');
console.log(tune_6_8);
console.log('\nConverted to M:12/8:');
try {
  const converted = toggleMeter_6_8_to_12_8(tune_6_8);
  console.log(converted);
} catch (err) {
  console.error('Error:', err.message);
}

// // Example 5: Hornpipe to swing
// const hornpipe = `X:1
// T:Example Hornpipe
// M:4/4
// L:1/8
// K:D
// D2 FA dA FD | C2 EG cE GC |
// B2 dB AF D2 | E2 GB e2 d2 |]`;

// console.log('\n=== Example 5: Hornpipe to Swing ===');
// console.log('Original (M:4/4, straight eighth notes):');
// console.log(hornpipe);
// console.log('\nConverted to swing (M:12/8):');
// try {
//   const swing = hornpipeToSwing(hornpipe);
//   console.log(swing);
//   console.log('\nExplanation:');
//   console.log('- Pairs of equal eighth notes (FA) become swing rhythm (F2A)');
//   console.log('- Longer notes (D2) are proportionally extended (D3)');
// } catch (err) {
//   console.error('Error:', err.message);
// }

console.log('\n=== Tests Complete ===');
