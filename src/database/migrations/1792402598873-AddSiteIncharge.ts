import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSiteIncharge1792402598873 implements MigrationInterface {
  name = 'AddSiteIncharge1792402598873';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`sites\` ADD \`inchargeId\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sites\` ADD CONSTRAINT \`FK_7e2c2b60306d6d421b2ce21310c\` FOREIGN KEY (\`inchargeId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`sites\` DROP FOREIGN KEY \`FK_7e2c2b60306d6d421b2ce21310c\``,
    );
    await queryRunner.query(`ALTER TABLE \`sites\` DROP COLUMN \`inchargeId\``);
  }
}
