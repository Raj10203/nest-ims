import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1791952047526 implements MigrationInterface {
  name = 'Migrations1791952047526';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`sites\` DROP FOREIGN KEY \`FK_sites_createdById\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_sites_code\` ON \`sites\``);
    await queryRunner.query(
      `ALTER TABLE \`sites\` ADD UNIQUE INDEX \`IDX_dde6621eadc0c9c9621360ec66\` (\`code\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sites\` ADD CONSTRAINT \`FK_caba8718c7f531df24d15d24750\` FOREIGN KEY (\`createdById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`sites\` DROP FOREIGN KEY \`FK_caba8718c7f531df24d15d24750\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sites\` DROP INDEX \`IDX_dde6621eadc0c9c9621360ec66\``,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_sites_code\` ON \`sites\` (\`code\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sites\` ADD CONSTRAINT \`FK_sites_createdById\` FOREIGN KEY (\`createdById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}
