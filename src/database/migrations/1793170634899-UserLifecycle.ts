import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserLifecycle1793170634899 implements MigrationInterface {
  name = 'UserLifecycle1793170634899';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`activatedAt\` timestamp NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`invitedAt\` timestamp NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`isActive\` tinyint NOT NULL DEFAULT 1`,
    );
    // The exact moments are unknown for existing rows: the verification time
    // (set when the invitation was accepted) and the latest link's send time
    // (72 h before its expiry) are the closest records.
    await queryRunner.query(
      `UPDATE \`users\` SET \`activatedAt\` = COALESCE(\`emailVerifiedAt\`, \`createdAt\`) WHERE \`password\` IS NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE \`users\` SET \`invitedAt\` = COALESCE(\`inviteExpiresAt\` - INTERVAL 72 HOUR, \`createdAt\`) WHERE \`password\` IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`isActive\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`invitedAt\``);
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`activatedAt\``,
    );
  }
}
