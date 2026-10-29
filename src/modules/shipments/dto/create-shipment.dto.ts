import { z } from 'zod';
import type { ErrorKey } from '../../../common/i18n/i18n-message.js';

const transport = {
  vehicleNumber: z.string().trim().min(1).max(20).toUpperCase().nullish(),
  driverName: z.string().trim().min(1).max(100).nullish(),
  driverPhone: z
    .string()
    .trim()
    .regex(
      /^\+?[0-9 -]{6,20}$/,
      'errors.shipments.phoneFormat' satisfies ErrorKey,
    )
    .nullish(),
  note: z.string().trim().min(1).max(1000).nullish(),
};

export const createShipmentSchema = z.object({
  vehicleNumber: transport.vehicleNumber.meta({ example: 'GJ01AB1234' }),
  driverName: transport.driverName.meta({ example: 'Ramesh Kumar' }),
  driverPhone: transport.driverPhone.meta({ example: '+91 98765 43210' }),
  note: transport.note.meta({ example: null }),
});

export type CreateShipmentDto = z.output<typeof createShipmentSchema>;

export const updateShipmentSchema = z
  .object(transport)
  .meta({ example: { driverPhone: '+91 98765 43210' } });

export type UpdateShipmentDto = z.output<typeof updateShipmentSchema>;

export const closeShipmentSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .meta({ example: 'Two boxes were not on the truck' }),
});

export type CloseShipmentDto = z.output<typeof closeShipmentSchema>;
