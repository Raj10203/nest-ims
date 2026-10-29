import { MigrationInterface, QueryRunner } from 'typeorm';

export class Notifications1793254492666 implements MigrationInterface {
  name = 'Notifications1793254492666';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`notifications\` (\`id\` int NOT NULL AUTO_INCREMENT, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`userId\` int NOT NULL, \`type\` varchar(50) NOT NULL, \`data\` json NOT NULL, \`readAt\` datetime NULL, INDEX \`IDX_eb224d6d3acf40220d84a63720\` (\`userId\`, \`readAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`notifications\` ADD CONSTRAINT \`FK_692a909ee0fa9383e7859f9b406\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`notifications\` DROP FOREIGN KEY \`FK_692a909ee0fa9383e7859f9b406\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_eb224d6d3acf40220d84a63720\` ON \`notifications\``,
    );
    await queryRunner.query(`DROP TABLE \`notifications\``);
  }
}
