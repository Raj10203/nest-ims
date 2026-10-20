import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAvatarUrl1792489672894 implements MigrationInterface {
  name = 'AddUserAvatarUrl1792489672894';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`avatarUrl\` varchar(1024) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`avatarUrl\``);
  }
}
