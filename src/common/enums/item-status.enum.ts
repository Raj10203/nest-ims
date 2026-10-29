// Issue flows add their statuses as they arrive.
export enum ItemStatus {
  AVAILABLE = 'available',
  // In a package at headquarters, waiting for dispatch.
  PACKED = 'packed',
  IN_TRANSIT = 'in_transit',
  // Never received: its last location stays the shipment.
  MISSING = 'missing',
}
