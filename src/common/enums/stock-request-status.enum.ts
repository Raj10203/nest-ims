// The review chain (HQ reviewer, then a manager), then delivery. The delivery
// statuses follow from the received counts (syncRequestStatus).
export enum StockRequestStatus {
  PENDING_REVIEW = 'pending_review',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  IN_TRANSIT = 'in_transit',
  PARTIALLY_FULFILLED = 'partially_fulfilled',
  FULFILLED = 'fulfilled',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}
