import { MigrationInterface, QueryRunner } from 'typeorm';

// Verification is enforced from this release on. Accounts that already exist
// are trusted, so they are not locked out of the API on deploy.
export class BackfillEmailVerifiedAt1792146605380 implements MigrationInterface {
  name = 'BackfillEmailVerifiedAt1792146605380';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE \`users\` SET \`emailVerifiedAt\` = CURRENT_TIMESTAMP WHERE \`emailVerifiedAt\` IS NULL`,
    );
  }

  // Which rows were backfilled is not recorded, so there is nothing to undo.
  public async down(): Promise<void> {}
}
