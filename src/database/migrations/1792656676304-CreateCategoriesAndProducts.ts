import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCategoriesAndProducts1792656676304 implements MigrationInterface {
  name = 'CreateCategoriesAndProducts1792656676304';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`categories\` (\`id\` int NOT NULL AUTO_INCREMENT, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`name\` varchar(100) NOT NULL, \`description\` varchar(500) NULL, \`isActive\` tinyint NOT NULL DEFAULT 1, \`createdById\` int NULL, UNIQUE INDEX \`IDX_8b0be371d28245da6e4f4b6187\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`products\` (\`id\` int NOT NULL AUTO_INCREMENT, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`name\` varchar(150) NOT NULL, \`prefix\` varchar(10) NOT NULL, \`categoryId\` int NOT NULL, \`type\` varchar(20) NOT NULL, \`measureType\` varchar(10) NOT NULL, \`packSize\` int UNSIGNED NULL, \`packUnit\` varchar(10) NULL, \`calibrationIntervalDays\` int UNSIGNED NULL, \`description\` varchar(500) NULL, \`isActive\` tinyint NOT NULL DEFAULT 1, \`createdById\` int NULL, UNIQUE INDEX \`IDX_3b5b383ea37f0a522fc03e1cd2\` (\`prefix\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`categories\` ADD CONSTRAINT \`FK_a6ada6f4dcf60db496fe71d7a96\` FOREIGN KEY (\`createdById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`products\` ADD CONSTRAINT \`FK_ff56834e735fa78a15d0cf21926\` FOREIGN KEY (\`categoryId\`) REFERENCES \`categories\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`products\` ADD CONSTRAINT \`FK_de1043dff8f68e83a20480b00f7\` FOREIGN KEY (\`createdById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`products\` DROP FOREIGN KEY \`FK_de1043dff8f68e83a20480b00f7\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`products\` DROP FOREIGN KEY \`FK_ff56834e735fa78a15d0cf21926\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`categories\` DROP FOREIGN KEY \`FK_a6ada6f4dcf60db496fe71d7a96\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_3b5b383ea37f0a522fc03e1cd2\` ON \`products\``,
    );
    await queryRunner.query(`DROP TABLE \`products\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_8b0be371d28245da6e4f4b6187\` ON \`categories\``,
    );
    await queryRunner.query(`DROP TABLE \`categories\``);
  }
}
