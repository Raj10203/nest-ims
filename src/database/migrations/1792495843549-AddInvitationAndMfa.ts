import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvitationAndMfa1792495843549 implements MigrationInterface {
  name = 'AddInvitationAndMfa1792495843549';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`inviteTokenHash\` char(64) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`inviteExpiresAt\` timestamp NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`mfaEnabled\` tinyint NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`mfaOtpHash\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`mfaOtpExpiresAt\` timestamp NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`mfaOtpAttempts\` int NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` CHANGE \`password\` \`password\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_442f45b77973833ad971a66c12\` ON \`users\` (\`inviteTokenHash\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_442f45b77973833ad971a66c12\` ON \`users\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` CHANGE \`password\` \`password\` varchar(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`mfaOtpAttempts\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`mfaOtpExpiresAt\``,
    );
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`mfaOtpHash\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`mfaEnabled\``);
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`inviteExpiresAt\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`inviteTokenHash\``,
    );
  }
}
