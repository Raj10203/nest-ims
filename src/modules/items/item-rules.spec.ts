import { ProductType } from '../../common/enums/product-type.enum.js';
import { itemDefaults, itemRuleErrors } from './item-rules.js';

describe('item rules', () => {
  it('starts tools at 100 and consumables without a condition', () => {
    const tool = {
      type: ProductType.NON_CONSUMABLE,
      calibrationIntervalDays: null,
    };
    const box = { type: ProductType.CONSUMABLE, calibrationIntervalDays: null };
    expect(itemDefaults(tool)).toEqual({
      condition: 100,
      nextCalibrationDueAt: null,
    });
    expect(itemDefaults(box).condition).toBeNull();
  });

  it('makes a calibrated item due one interval from today', () => {
    const meter = {
      type: ProductType.CALIBRATED,
      calibrationIntervalDays: 365,
    };
    expect(
      itemDefaults(meter, new Date('2026-01-10T08:00:00Z'))
        .nextCalibrationDueAt,
    ).toBe('2027-01-10');
  });

  it('rejects a condition on consumables and a due date on others', () => {
    expect(
      itemRuleErrors(ProductType.CONSUMABLE, { condition: 80 }).map(
        (e) => e.path,
      ),
    ).toEqual(['condition']);
    expect(
      itemRuleErrors(ProductType.PERSONAL_ISSUE, {
        condition: 80,
        nextCalibrationDueAt: '2027-01-01',
      }).map((e) => e.path),
    ).toEqual(['nextCalibrationDueAt']);
    expect(
      itemRuleErrors(ProductType.CALIBRATED, {
        condition: 90,
        nextCalibrationDueAt: '2027-01-01',
      }),
    ).toEqual([]);
  });
});
