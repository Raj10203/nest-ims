// Stored as varchar, not a MySQL ENUM, so adding a type needs no ALTER TABLE.
export enum ProductType {
  CONSUMABLE = 'consumable',
  NON_CONSUMABLE = 'non_consumable',
  PERSONAL_ISSUE = 'personal_issue',
  CALIBRATED = 'calibrated',
}
