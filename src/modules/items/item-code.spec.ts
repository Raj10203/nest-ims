import { autoNumberOf, autoSuffix, itemCode } from './item-code.js';

describe('item codes', () => {
  it('pads automatic numbers to six digits', () => {
    expect(itemCode('DRL', autoSuffix(14))).toBe('DRL-000014');
    expect(autoSuffix(1234567)).toBe('1234567');
  });

  it('recognises a typed suffix an automatic code could produce', () => {
    expect(autoNumberOf('000050')).toBe(50);
    expect(autoNumberOf('1234567')).toBe(1234567);
  });

  it('ignores suffixes automatic codes never produce', () => {
    for (const suffix of ['OLD17', '50', '0000050', '000000', '99999999999']) {
      expect(autoNumberOf(suffix)).toBeNull();
    }
  });
});
