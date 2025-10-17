const {
  getFirstBars,
  hasAnacrucis,
  toggleMeter_4_4_to_4_2,
  toggleMeter_6_8_to_12_8
} = require('../src/index.js');

// ============================================================================
// ABC MANIPULATION TESTS
// Based on manipulation.js - comprehensive tests for ABC manipulations
// ============================================================================

describe('ABC Manipulator - getFirstBars functionality', () => {
  const tuneWithAnacrusis = `X:1
T:Example Tune
M:4/4
L:1/8
K:D
FA | d2 cB A2 FA | d2 f2 e2 d2 |`;

  const tuneWithoutAnacrusis = `X:1
T:No Pickup
M:4/4
L:1/8
K:D
D2 FA dA FD | G2 Bc d2 cB | A2 AB c2 BA |]`;

  describe('single bar extraction', () => {
    test('extracts first bar from tune with anacrusis (excluding pickup)', () => {
      const result = getFirstBars(tuneWithAnacrusis, 1, false);

      expect(result).toContain('X:1');
      expect(result).toContain('T:Example Tune');
      expect(result).toContain('M:4/4');
      expect(result).toContain('L:1/8');
      expect(result).toContain('K:D');
      expect(result).toContain('K:D\nd2 cB A2 FA');
      expect(result).not.toContain('K:D\nFA |'); // anacrusis excluded
      expect(result).not.toContain('d2 f2 e2 d2');
    });

    test('extracts first bar from tune with anacrusis (including pickup)', () => {
      const result = getFirstBars(tuneWithAnacrusis, 1, true);

      expect(result).toContain('FA |'); // anacrusis included
      expect(result).toContain('d2 cB A2 FA');
      expect(result).not.toContain('d2 f2 e2 d2');
    });

    test('extracts first bar from tune without anacrusis', () => {
      const result = getFirstBars(tuneWithoutAnacrusis, 1, false);

      expect(result).toContain('D2 FA dA FD');
      expect(result).not.toContain('G2 Bc d2 cB');
    });
  });

  describe('multiple bar extraction', () => {
    test('extracts first two bars (excluding anacrusis)', () => {
      const result = getFirstBars(tuneWithAnacrusis, 2, false);

      expect(result).not.toContain('K:D\nFA |'); // anacrusis excluded
      expect(result).toContain('K:D\nd2 cB A2 FA');
      expect(result).toContain('d2 f2 e2 d2');
    });

    test('extracts first two bars (including anacrusis)', () => {
      const result = getFirstBars(tuneWithAnacrusis, 2, true);

      expect(result).toContain('K:D\nFA |'); // anacrusis included
      expect(result).toContain('d2 cB A2 FA');
      expect(result).toContain('d2 f2 e2 d2');
    });

    test('extracts first three bars from longer tune', () => {
      const longerTune = `X:1
T:Longer Tune
M:4/4
L:1/8
K:D
D2 FA dA FD | G2 Bc d2 cB |
A2 AB c2 BA | G2 FE D4 |
d2 fd e2 ce | B2 GB A4 |]`;

      const result = getFirstBars(longerTune, 3);

      expect(result).toContain('D2 FA dA FD');
      expect(result).toContain('G2 Bc d2 cB');
      expect(result).toContain('A2 AB c2 BA');
      expect(result).not.toContain('G2 FE D4');
      expect(result).not.toContain('d2 fd e2 ce');
    });
  });

  describe('different time signatures', () => {
    test('extracts first bar from 6/8 tune', () => {
      const jig = `X:1
T:Simple Jig
M:6/8
L:1/8
K:D
DFA dAF | GBd gdB |
AFD DFA | G2E E3 |]`;

      const result = getFirstBars(jig, 1);

      expect(result).toContain('DFA dAF');
      expect(result).not.toContain('GBd gdB');
    });

    test('extracts first bar from 6/8 tune with anacrusis', () => {
      const jigWithPickup = `X:1
T:Jig with Pickup
M:6/8
L:1/8
K:D
FA | DFA dAF | GBd gdB |]`;

      const resultWithout = getFirstBars(jigWithPickup, 1, false);
      const resultWith = getFirstBars(jigWithPickup, 1, true);

      expect(resultWithout).not.toContain('FA |');
      expect(resultWithout).toContain('DFA dAF');

      expect(resultWith).toContain('FA |');
      expect(resultWith).toContain('DFA dAF');
    });
  });

  describe('error handling', () => {
    test('throws error when requesting more bars than available', () => {
      expect(() => {
        getFirstBars(tuneWithAnacrusis, 10);
      }).toThrow('Not enough complete bars');
    });

    test('throws error when no complete bars found', () => {
      const onlyAnacrusis = `X:1
T:Only Pickup
M:4/4
L:1/8
K:D
FA |]`;

      expect(() => {
        getFirstBars(onlyAnacrusis, 1);
      }).toThrow('No complete bars found');
    });
  });
});

describe('ABC Manipulator - hasAnacrucis detection', () => {
  test('detects anacrusis in various meters', () => {
    const cases = [
      {
        meter: '4/4',
        abc: 'X:1\nM:4/4\nL:1/8\nK:D\nFA | d2 cB A2 FA |',
        expected: true
      },
      {
        meter: '4/4',
        abc: 'X:1\nM:4/4\nL:1/8\nK:D\nD2 FA dA FD | G2 Bc d2 cB |',
        expected: false
      },
      {
        meter: '6/8',
        abc: 'X:1\nM:6/8\nL:1/8\nK:D\nFA | DFA dAF |',
        expected: true
      },
      {
        meter: '6/8',
        abc: 'X:1\nM:6/8\nL:1/8\nK:D\nDFA dAF | GBd gdB |',
        expected: false
      },
      {
        meter: '4/2',
        abc: 'X:1\nM:4/2\nL:1/8\nK:D\nFA | d2 cB A2 FA d2 f2 e2 d2 |',
        expected: true
      },
      {
        meter: '12/8',
        abc: 'X:1\nM:12/8\nL:1/8\nK:D\nDFA dAF GBd gdB |',
        expected: false
      }
    ];

    cases.forEach(({ abc, expected}) => {
      expect(hasAnacrucis(abc)).toBe(expected);
    });
  });
});

describe('ABC Manipulator - meter toggles (4/4 ↔ 4/2)', () => {
  describe('4/4 to 4/2 conversion', () => {
    test('converts simple 4/4 to 4/2', () => {
      const tune_4_4 = `X:1
T:Example in 4/4
M:4/4
L:1/8
K:D
D2 FA dA FD | G2 Bc d2 cB |
A2 AB c2 BA | G2 FE D4 |]`;

      const result = toggleMeter_4_4_to_4_2(tune_4_4);

      expect(result).toContain('M:4/2');
      expect(result).not.toContain('M:4/4');

      // Should merge pairs of bars
      const barCount = (result.match(/\|/g) || []).length;
      const originalBarCount = (tune_4_4.match(/\|/g) || []).length;
      expect(barCount).toBeLessThan(originalBarCount);
    });

    test('converts 4/4 with anacrusis to 4/2', () => {
      const tune_4_4_anacrusis = `X:1
T:With Anacrusis
M:4/4
L:1/8
K:D
FA | d2 cB A2 FA | d2 f2 e2 d2 |
c2 BA G2 FE | D4 D4 |]`;

      const result = toggleMeter_4_4_to_4_2(tune_4_4_anacrusis);

      expect(result).toContain('M:4/2');
      expect(result).toContain('FA |'); // anacrusis preserved

      // Verify it's reversible
      const restored = toggleMeter_4_4_to_4_2(result);
      expect(restored).toBe(tune_4_4_anacrusis);
    });
  });

  describe('4/2 to 4/4 conversion', () => {
    test('converts simple 4/2 to 4/4', () => {
      const tune_4_2 = `X:1
T:Example in 4/2
M:4/2
L:1/8
K:D
D2 FA dA FD G2 Bc d2 cB |A2 AB c2 BA G2 FE D4 |]`;

      const result = toggleMeter_4_4_to_4_2(tune_4_2);

      expect(result).toContain('M:4/4');
      expect(result).not.toContain('M:4/2');

      // Should split bars in half
      const barCount = (result.match(/\|/g) || []).length;
      const originalBarCount = (tune_4_2.match(/\|/g) || []).length;
      expect(barCount).toBeGreaterThan(originalBarCount);
    });

    test('converts 4/2 with anacrusis to 4/4', () => {
      const tune_4_2_anacrusis = `X:1
T:4/2 with Anacrusis
M:4/2
L:1/8
K:D
FA | d2 cB A2 FA d2 f2 e2 d2 |c2 BA G2 FE D4 D4 |]`;

      const result = toggleMeter_4_4_to_4_2(tune_4_2_anacrusis);

      expect(result).toContain('M:4/4');
      expect(result).toContain('FA |'); // anacrusis preserved

      // Verify it's reversible
      const restored = toggleMeter_4_4_to_4_2(result);
      expect(restored).toBe(tune_4_2_anacrusis);
    });
  });

  describe('reversibility', () => {
    test('4/4 → 4/2 → 4/4 preserves original', () => {
      const original = `X:1
T:Reversibility Test
M:4/4
L:1/8
K:D
D2 FA dA FD | G2 Bc d2 cB |
A2 AB c2 BA | G2 FE D4 |]`;

      const to_4_2 = toggleMeter_4_4_to_4_2(original);
      const back_to_4_4 = toggleMeter_4_4_to_4_2(to_4_2);

      expect(back_to_4_4).toBe(original);
    });

    test('4/2 → 4/4 → 4/2 preserves original', () => {
      const original = `X:1
T:Reversibility Test
M:4/2
L:1/8
K:D
D2 FA dA FD G2 Bc d2 cB |A2 AB c2 BA G2 FE D4 |]`;

      const to_4_4 = toggleMeter_4_4_to_4_2(original);
      const back_to_4_2 = toggleMeter_4_4_to_4_2(to_4_4);

      expect(back_to_4_2).toBe(original);
    });
  });
});

describe('ABC Manipulator - meter toggles (6/8 ↔ 12/8)', () => {
  describe('6/8 to 12/8 conversion', () => {
    test('converts simple 6/8 to 12/8', () => {
      const tune_6_8 = `X:1
T:Example in 6/8
M:6/8
L:1/8
K:D
DFA dAF | GBd gdB |
AFD DFA | G2E E3 |]`;

      const result = toggleMeter_6_8_to_12_8(tune_6_8);

      expect(result).toContain('M:12/8');
      expect(result).not.toContain('M:6/8');

      // Should merge pairs of bars
      const barCount = (result.match(/\|/g) || []).length;
      const originalBarCount = (tune_6_8.match(/\|/g) || []).length;
      expect(barCount).toBeLessThan(originalBarCount);
    });

    test('converts 6/8 with anacrusis to 12/8', () => {
      const tune_6_8_anacrusis = `X:1
T:Jig with Anacrusis
M:6/8
L:1/8
K:D
FA | DFA dAF | GBd gdB |
AFD DFA | G2E E3 |]`;

      const result = toggleMeter_6_8_to_12_8(tune_6_8_anacrusis);

      expect(result).toContain('M:12/8');
      expect(result).toContain('FA |'); // anacrusis preserved

      // Verify it's reversible
      const restored = toggleMeter_6_8_to_12_8(result);
      expect(restored).toBe(tune_6_8_anacrusis);
    });
  });

  describe('12/8 to 6/8 conversion', () => {
    test('converts simple 12/8 to 6/8', () => {
      const tune_12_8 = `X:1
T:Example in 12/8
M:12/8
L:1/8
K:D
DFA dAF GBd gdB |AFD DFA G2E E3 |]`;

      const result = toggleMeter_6_8_to_12_8(tune_12_8);

      expect(result).toContain('M:6/8');
      expect(result).not.toContain('M:12/8');

      // Should split bars in half
      const barCount = (result.match(/\|/g) || []).length;
      const originalBarCount = (tune_12_8.match(/\|/g) || []).length;
      expect(barCount).toBeGreaterThan(originalBarCount);
    });

    test('converts 12/8 with anacrusis to 6/8', () => {
      const tune_12_8_anacrusis = `X:1
T:12/8 with Anacrusis
M:12/8
L:1/8
K:D
FA | DFA dAF GBd gdB |AFD DFA G2E E3 |]`;

      const result = toggleMeter_6_8_to_12_8(tune_12_8_anacrusis);

      expect(result).toContain('M:6/8');
      expect(result).toContain('FA |'); // anacrusis preserved

      // Verify it's reversible
      const restored = toggleMeter_6_8_to_12_8(result);
      expect(restored).toBe(tune_12_8_anacrusis);
    });
  });

  describe('reversibility', () => {
    test('6/8 → 12/8 → 6/8 preserves original', () => {
      const original = `X:1
T:Reversibility Test
M:6/8
L:1/8
K:D
DFA dAF | GBd gdB |
AFD DFA | G2E E3 |]`;

      const to_12_8 = toggleMeter_6_8_to_12_8(original);
      const back_to_6_8 = toggleMeter_6_8_to_12_8(to_12_8);

      expect(back_to_6_8).toBe(original);
    });

    test('12/8 → 6/8 → 12/8 preserves original', () => {
      const original = `X:1
T:Reversibility Test
M:12/8
L:1/8
K:D
DFA dAF GBd gdB |AFD DFA G2E E3 |]`;

      const to_6_8 = toggleMeter_6_8_to_12_8(original);
      const back_to_12_8 = toggleMeter_6_8_to_12_8(to_6_8);

      expect(back_to_12_8).toBe(original);
    });
  });
});

describe('ABC Manipulator - error handling', () => {
  test('throws error for wrong unit length in 4/4 toggle', () => {
    const wrongUnitLength = `X:1
M:4/4
L:1/4
K:D
D F A d |]`;

    expect(() => {
      toggleMeter_4_4_to_4_2(wrongUnitLength);
    }).toThrow('This function only works with L:1/8');
  });

  test('throws error for wrong meter in 4/4 toggle', () => {
    const wrongMeter = `X:1
M:3/4
L:1/8
K:D
D2 FA |]`;

    expect(() => {
      toggleMeter_4_4_to_4_2(wrongMeter);
    }).toThrow('Meter must be 4/4 or 4/2');
  });

  test('throws error for wrong meter in 6/8 toggle', () => {
    const wrongMeter = `X:1
M:3/4
L:1/8
K:D
D2 FA |]`;

    expect(() => {
      toggleMeter_6_8_to_12_8(wrongMeter);
    }).toThrow('Meter must be 6/8 or 12/8');
  });
});
