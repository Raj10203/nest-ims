import { z } from 'zod';
import { PackageStatus } from '../../../common/enums/package-status.enum.js';
import { ShipmentStatus } from '../../../common/enums/shipment-status.enum.js';

const page = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const listShipmentsQuerySchema = z.object({
  status: z.enum(ShipmentStatus).optional(),
  fromSiteId: z.coerce.number().int().positive().optional(),
  ...page,
});

export type ListShipmentsQueryDto = z.output<typeof listShipmentsQuerySchema>;

export const listPackagesQuerySchema = z.object({
  status: z.enum(PackageStatus).optional(),
  shipmentId: z.coerce.number().int().positive().optional(),
  requestId: z.coerce.number().int().positive().optional(),
  siteId: z.coerce.number().int().positive().optional(),
  ...page,
});

export type ListPackagesQueryDto = z.output<typeof listPackagesQuerySchema>;
