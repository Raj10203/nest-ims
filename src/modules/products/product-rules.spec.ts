import { BadRequestException } from '@nestjs/common';
import { MeasureType } from '../../common/enums/measure-type.enum.js';
import { PackUnit } from '../../common/enums/pack-unit.enum.js';
import { ProductType } from '../../common/enums/product-type.enum.js';
import { assertProductRules, productRuleErrors } from './product-rules.js';

const single = {
  type: ProductType.NON_CONSUMABLE,
  measureType: MeasureType.SINGLE,
  packSize: null,
  packUnit: null,
  calibrationIntervalDays: null,
};
const boltBox = {
  ...single,
  type: ProductType.CONSUMABLE,
  measureType: MeasureType.BULK,
  packSize: 100,
  packUnit: PackUnit.PCS,
};
const paths = (product: Parameters<typeof productRuleErrors>[0]) =>
  productRuleErrors(product).map(({ path, message }) => [path, message]);

describe('productRuleErrors', () => {
  it('accepts a single item and a consumable pack', () => {
    expect(paths(single)).toEqual([]);
    expect(paths(boltBox)).toEqual([]);
    expect(paths({ ...single, type: ProductType.PERSONAL_ISSUE })).toEqual([]);
  });

  it('allows bulk for consumables only', () => {
    expect(paths({ ...boltBox, type: ProductType.NON_CONSUMABLE })).toEqual([
      ['measureType', 'errors.products.bulkOnlyConsumable'],
    ]);
  });

  it('requires a pack for bulk and forbids it for single', () => {
    expect(paths({ ...boltBox, packSize: null, packUnit: null })).toEqual([
      ['packSize', 'errors.products.packRequired'],
      ['packUnit', 'errors.products.packRequired'],
    ]);
    expect(paths({ ...single, packSize: 10 })).toEqual([
      ['packSize', 'errors.products.packNotAllowed'],
    ]);
  });

  it('requires a calibration interval for calibrated products only', () => {
    expect(paths({ ...single, type: ProductType.CALIBRATED })).toEqual([
      ['calibrationIntervalDays', 'errors.products.calibrationRequired'],
    ]);
    expect(
      paths({
        ...single,
        type: ProductType.CALIBRATED,
        calibrationIntervalDays: 365,
      }),
    ).toEqual([]);
    expect(paths({ ...boltBox, calibrationIntervalDays: 365 })).toEqual([
      ['calibrationIntervalDays', 'errors.products.calibrationNotAllowed'],
    ]);
  });

  it('throws the same 400 body as the validation pipe', () => {
    expect(() => assertProductRules({ ...single, packSize: 10 })).toThrow(
      BadRequestException,
    );
    try {
      assertProductRules({ ...single, packSize: 10 });
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toEqual({
        message: 'errors.validationFailed',
        errors: [
          { path: 'packSize', message: 'errors.products.packNotAllowed' },
        ],
      });
    }
  });
});
