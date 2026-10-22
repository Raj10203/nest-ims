import { BadRequestException } from '@nestjs/common';
import { MeasureType } from '../../common/enums/measure-type.enum.js';
import { ProductType } from '../../common/enums/product-type.enum.js';
import { type ErrorKey, i18nMessage } from '../../common/i18n/i18n-message.js';
import type { Product } from '../../entities/product.entity.js';

type ProductShape = Pick<
  Product,
  'type' | 'measureType' | 'packSize' | 'packUnit' | 'calibrationIntervalDays'
>;

// Stock tracking relies on these combinations.
export function productRuleErrors(product: ProductShape) {
  const errors: { path: keyof ProductShape; message: ErrorKey }[] = [];
  const bulk = product.measureType === MeasureType.BULK;
  if (bulk && product.type !== ProductType.CONSUMABLE) {
    errors.push({
      path: 'measureType',
      message: 'errors.products.bulkOnlyConsumable',
    });
  }
  for (const path of ['packSize', 'packUnit'] as const) {
    const present = product[path] != null;
    if (bulk && !present) {
      errors.push({ path, message: 'errors.products.packRequired' });
    }
    if (!bulk && present) {
      errors.push({ path, message: 'errors.products.packNotAllowed' });
    }
  }
  const calibrated = product.type === ProductType.CALIBRATED;
  const hasInterval = product.calibrationIntervalDays != null;
  if (calibrated && !hasInterval) {
    errors.push({
      path: 'calibrationIntervalDays',
      message: 'errors.products.calibrationRequired',
    });
  }
  if (!calibrated && hasInterval) {
    errors.push({
      path: 'calibrationIntervalDays',
      message: 'errors.products.calibrationNotAllowed',
    });
  }
  return errors;
}

// Same 400 body as ZodValidationPipe, so clients handle one shape.
export function assertProductRules(product: ProductShape): void {
  const errors = productRuleErrors(product);
  if (errors.length) {
    throw new BadRequestException({
      ...i18nMessage('errors.validationFailed'),
      errors,
    });
  }
}
