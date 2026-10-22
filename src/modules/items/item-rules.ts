import { BadRequestException } from '@nestjs/common';
import { ProductType } from '../../common/enums/product-type.enum.js';
import { type ErrorKey, i18nMessage } from '../../common/i18n/i18n-message.js';
import type { Product } from '../../entities/product.entity.js';

interface ItemFields {
  condition?: number | null;
  nextCalibrationDueAt?: string | null;
}

// Consumables have no condition; only calibrated products have a due date.
export function itemRuleErrors(type: ProductType, item: ItemFields) {
  const errors: { path: keyof ItemFields; message: ErrorKey }[] = [];
  if (item.condition != null && type === ProductType.CONSUMABLE) {
    errors.push({
      path: 'condition',
      message: 'errors.items.conditionNotAllowed',
    });
  }
  if (item.nextCalibrationDueAt != null && type !== ProductType.CALIBRATED) {
    errors.push({
      path: 'nextCalibrationDueAt',
      message: 'errors.items.calibrationNotAllowed',
    });
  }
  return errors;
}

export function assertItemRules(type: ProductType, item: ItemFields): void {
  const errors = itemRuleErrors(type, item);
  if (errors.length) {
    throw new BadRequestException({
      ...i18nMessage('errors.validationFailed'),
      errors,
    });
  }
}

// New tools start in perfect condition; a calibrated product is taken as just
// calibrated, so it is due one interval from today.
export function itemDefaults(
  product: Pick<Product, 'type' | 'calibrationIntervalDays'>,
  today = new Date(),
) {
  const calibrated =
    product.type === ProductType.CALIBRATED && product.calibrationIntervalDays;
  return {
    condition: product.type === ProductType.CONSUMABLE ? null : 100,
    nextCalibrationDueAt: calibrated
      ? new Date(today.getTime() + calibrated * 86_400_000)
          .toISOString()
          .slice(0, 10)
      : null,
  };
}
