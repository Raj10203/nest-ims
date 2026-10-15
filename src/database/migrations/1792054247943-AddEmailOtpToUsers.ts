import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailOtpToUsers1792054247943 implements MigrationInterface {
  name = 'AddEmailOtpToUsers1792054247943';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`emailOtpHash\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`emailOtpExpiresAt\` timestamp NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`emailOtpAttempts\` int NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`emailOtpAttempts\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`emailOtpExpiresAt\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`emailOtpHash\``,
    );
  }
}
