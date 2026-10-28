import { MigrationInterface, QueryRunner } from 'typeorm';

export class InventorySetup1792661892134 implements MigrationInterface {
  name = 'InventorySetup1792661892134';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`user_feature_roles\` (\`id\` int NOT NULL AUTO_INCREMENT, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`userId\` int NOT NULL, \`roleId\` int NOT NULL, \`grantedById\` int NULL, UNIQUE INDEX \`IDX_ef3f0da4c605cd892d08445147\` (\`userId\`, \`roleId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`items\` (\`id\` int NOT NULL AUTO_INCREMENT, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`code\` varchar(40) NOT NULL, \`productId\` int NOT NULL, \`siteId\` int NOT NULL, \`status\` varchar(20) NOT NULL, \`condition\` tinyint UNSIGNED NULL, \`serialNumber\` varchar(100) NULL, \`nextCalibrationDueAt\` date NULL, \`note\` varchar(500) NULL, \`createdById\` int NULL, INDEX \`IDX_eb8007b3af4ab5212fe3776968\` (\`productId\`, \`siteId\`, \`status\`), UNIQUE INDEX \`IDX_1b0a705ce0dc5430c020a0ec31\` (\`code\`), UNIQUE INDEX \`IDX_989a545303debb408572e04f87\` (\`productId\`, \`serialNumber\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`item_movements\` (\`id\` int NOT NULL AUTO_INCREMENT, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`itemId\` int NOT NULL, \`action\` varchar(30) NOT NULL, \`siteId\` int NOT NULL, \`status\` varchar(20) NOT NULL, \`conditionBefore\` tinyint UNSIGNED NULL, \`conditionAfter\` tinyint UNSIGNED NULL, \`note\` varchar(500) NULL, \`performedById\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`roles\` ADD \`kind\` varchar(10) NOT NULL DEFAULT 'primary'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sites\` ADD \`pincode\` varchar(10) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sites\` ADD \`type\` varchar(10) NOT NULL DEFAULT 'site'`,
    );
    await queryRunner.query(`ALTER TABLE \`users\` ADD \`siteId\` int NULL`);
    await queryRunner.query(
      `ALTER TABLE \`products\` ADD \`lastItemNumber\` int UNSIGNED NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_feature_roles\` ADD CONSTRAINT \`FK_afe2532255350ee1ade32b95438\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_feature_roles\` ADD CONSTRAINT \`FK_be0bc409baeed5b3d3ec8068ac3\` FOREIGN KEY (\`roleId\`) REFERENCES \`roles\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_feature_roles\` ADD CONSTRAINT \`FK_db06d3c971fa694a86efa2b6154\` FOREIGN KEY (\`grantedById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD CONSTRAINT \`FK_0515424a6578918709b47d19d70\` FOREIGN KEY (\`siteId\`) REFERENCES \`sites\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`items\` ADD CONSTRAINT \`FK_4be3a424b9afbf6445222f89018\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`items\` ADD CONSTRAINT \`FK_6e77b327d4c0d66f6ffb3d34be9\` FOREIGN KEY (\`siteId\`) REFERENCES \`sites\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`items\` ADD CONSTRAINT \`FK_13080a822941d205bc41a4024f9\` FOREIGN KEY (\`createdById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`item_movements\` ADD CONSTRAINT \`FK_7c9e6b3ee93fa4efcf3c0348b85\` FOREIGN KEY (\`itemId\`) REFERENCES \`items\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`item_movements\` ADD CONSTRAINT \`FK_ff23b09bfe5ad83e4577ba55b64\` FOREIGN KEY (\`siteId\`) REFERENCES \`sites\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`item_movements\` ADD CONSTRAINT \`FK_bdcef44c5053378cdab86a9982f\` FOREIGN KEY (\`performedById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`item_movements\` DROP FOREIGN KEY \`FK_bdcef44c5053378cdab86a9982f\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`item_movements\` DROP FOREIGN KEY \`FK_ff23b09bfe5ad83e4577ba55b64\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`item_movements\` DROP FOREIGN KEY \`FK_7c9e6b3ee93fa4efcf3c0348b85\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`items\` DROP FOREIGN KEY \`FK_13080a822941d205bc41a4024f9\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`items\` DROP FOREIGN KEY \`FK_6e77b327d4c0d66f6ffb3d34be9\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`items\` DROP FOREIGN KEY \`FK_4be3a424b9afbf6445222f89018\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_0515424a6578918709b47d19d70\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_feature_roles\` DROP FOREIGN KEY \`FK_db06d3c971fa694a86efa2b6154\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_feature_roles\` DROP FOREIGN KEY \`FK_be0bc409baeed5b3d3ec8068ac3\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_feature_roles\` DROP FOREIGN KEY \`FK_afe2532255350ee1ade32b95438\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`products\` DROP COLUMN \`lastItemNumber\``,
    );
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`siteId\``);
    await queryRunner.query(`ALTER TABLE \`sites\` DROP COLUMN \`type\``);
    await queryRunner.query(`ALTER TABLE \`sites\` DROP COLUMN \`pincode\``);
    await queryRunner.query(`ALTER TABLE \`roles\` DROP COLUMN \`kind\``);
    await queryRunner.query(`DROP TABLE \`item_movements\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_989a545303debb408572e04f87\` ON \`items\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_1b0a705ce0dc5430c020a0ec31\` ON \`items\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_eb8007b3af4ab5212fe3776968\` ON \`items\``,
    );
    await queryRunner.query(`DROP TABLE \`items\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_ef3f0da4c605cd892d08445147\` ON \`user_feature_roles\``,
    );
    await queryRunner.query(`DROP TABLE \`user_feature_roles\``);
  }
}
