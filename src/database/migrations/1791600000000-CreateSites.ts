import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSites1791600000000 implements MigrationInterface {
  name = 'CreateSites1791600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`sites\` (\`id\` int NOT NULL AUTO_INCREMENT, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`name\` varchar(150) NOT NULL, \`code\` varchar(50) NOT NULL, \`address\` varchar(255) NULL, \`city\` varchar(100) NULL, \`state\` varchar(100) NULL, \`isActive\` tinyint NOT NULL DEFAULT 1, \`createdById\` int NULL, UNIQUE INDEX \`IDX_sites_code\` (\`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sites\` ADD CONSTRAINT \`FK_sites_createdById\` FOREIGN KEY (\`createdById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`sites\` DROP FOREIGN KEY \`FK_sites_createdById\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_sites_code\` ON \`sites\``);
    await queryRunner.query(`DROP TABLE \`sites\``);
  }
}
