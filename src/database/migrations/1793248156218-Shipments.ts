import { MigrationInterface, QueryRunner } from 'typeorm';

export class Shipments1793248156218 implements MigrationInterface {
  name = 'Shipments1793248156218';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`shipments\` (\`id\` int NOT NULL AUTO_INCREMENT, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`status\` varchar(20) NOT NULL, \`vehicleNumber\` varchar(20) NULL, \`driverName\` varchar(100) NULL, \`driverPhone\` varchar(20) NULL, \`note\` varchar(1000) NULL, \`createdById\` int NULL, \`dispatchedById\` int NULL, \`dispatchedAt\` datetime NULL, \`closedById\` int NULL, \`closedAt\` datetime NULL, INDEX \`IDX_6a19baf6dd62cac42fbb40a518\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`packages\` (\`id\` int NOT NULL AUTO_INCREMENT, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`shipmentId\` int NOT NULL, \`requestId\` int NOT NULL, \`siteId\` int NOT NULL, \`status\` varchar(20) NOT NULL, \`createdById\` int NULL, \`receivedById\` int NULL, \`receivedAt\` datetime NULL, INDEX \`IDX_054e141da0e8540ca2465fc6f0\` (\`siteId\`, \`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`package_items\` (\`id\` int NOT NULL AUTO_INCREMENT, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`packageId\` int NOT NULL, \`itemId\` int NOT NULL, \`requestLineId\` int NOT NULL, \`status\` varchar(20) NOT NULL, \`receivedById\` int NULL, \`receivedAt\` datetime NULL, INDEX \`IDX_08d23b66219ec9e701af5bd57b\` (\`requestLineId\`, \`status\`), UNIQUE INDEX \`IDX_7c0bb77b028cd5d577195d44ad\` (\`packageId\`, \`itemId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`items\` ADD \`shipmentId\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`item_movements\` ADD \`shipmentId\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` ADD \`shipmentId\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`items\` DROP FOREIGN KEY \`FK_6e77b327d4c0d66f6ffb3d34be9\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_eb8007b3af4ab5212fe3776968\` ON \`items\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`items\` CHANGE \`siteId\` \`siteId\` int NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_eb8007b3af4ab5212fe3776968\` ON \`items\` (\`productId\`, \`siteId\`, \`status\`)`,
    );
    // TypeORM does not generate CHECK constraints for MySQL.
    await queryRunner.query(
      `ALTER TABLE \`items\` ADD CONSTRAINT \`CHK_items_location\` CHECK ((\`siteId\` IS NULL) <> (\`shipmentId\` IS NULL))`,
    );
    await queryRunner.query(
      `ALTER TABLE \`shipments\` ADD CONSTRAINT \`FK_96de1112a6c3b62bf5b5fc151df\` FOREIGN KEY (\`createdById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`shipments\` ADD CONSTRAINT \`FK_3e86cbe03377cb3919cbb04c451\` FOREIGN KEY (\`dispatchedById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`shipments\` ADD CONSTRAINT \`FK_462cfcd31df4ad2008f72325541\` FOREIGN KEY (\`closedById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`items\` ADD CONSTRAINT \`FK_6e77b327d4c0d66f6ffb3d34be9\` FOREIGN KEY (\`siteId\`) REFERENCES \`sites\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`items\` ADD CONSTRAINT \`FK_99eba803010b34bfb69bd3e00d4\` FOREIGN KEY (\`shipmentId\`) REFERENCES \`shipments\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`item_movements\` ADD CONSTRAINT \`FK_a9e5525b65a740e352bcad33afd\` FOREIGN KEY (\`shipmentId\`) REFERENCES \`shipments\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`packages\` ADD CONSTRAINT \`FK_fb9642a8d6f50641861f54abae2\` FOREIGN KEY (\`shipmentId\`) REFERENCES \`shipments\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`packages\` ADD CONSTRAINT \`FK_d7a071223f1211fbeff556bb8f8\` FOREIGN KEY (\`requestId\`) REFERENCES \`stock_requests\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`packages\` ADD CONSTRAINT \`FK_fa405ed6324244e70d3019a5102\` FOREIGN KEY (\`siteId\`) REFERENCES \`sites\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`packages\` ADD CONSTRAINT \`FK_98b16f59b717e596ae85197a0af\` FOREIGN KEY (\`createdById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`packages\` ADD CONSTRAINT \`FK_10a8e4cf9f8cfd65fe797008a34\` FOREIGN KEY (\`receivedById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`package_items\` ADD CONSTRAINT \`FK_1b5294bd34cd930013b6c41bae2\` FOREIGN KEY (\`packageId\`) REFERENCES \`packages\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`package_items\` ADD CONSTRAINT \`FK_286a4ae98873ac315a460b4914a\` FOREIGN KEY (\`itemId\`) REFERENCES \`items\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`package_items\` ADD CONSTRAINT \`FK_53146c1a32617a19ee6cc4851e8\` FOREIGN KEY (\`requestLineId\`) REFERENCES \`stock_request_lines\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`package_items\` ADD CONSTRAINT \`FK_c411b1f68dc995b4ebc3b9ba748\` FOREIGN KEY (\`receivedById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` ADD CONSTRAINT \`FK_12d11ab648e1427ffd9b5f1c71b\` FOREIGN KEY (\`shipmentId\`) REFERENCES \`shipments\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`items\` DROP CHECK \`CHK_items_location\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` DROP FOREIGN KEY \`FK_12d11ab648e1427ffd9b5f1c71b\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`package_items\` DROP FOREIGN KEY \`FK_c411b1f68dc995b4ebc3b9ba748\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`package_items\` DROP FOREIGN KEY \`FK_53146c1a32617a19ee6cc4851e8\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`package_items\` DROP FOREIGN KEY \`FK_286a4ae98873ac315a460b4914a\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`package_items\` DROP FOREIGN KEY \`FK_1b5294bd34cd930013b6c41bae2\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`packages\` DROP FOREIGN KEY \`FK_10a8e4cf9f8cfd65fe797008a34\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`packages\` DROP FOREIGN KEY \`FK_98b16f59b717e596ae85197a0af\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`packages\` DROP FOREIGN KEY \`FK_fa405ed6324244e70d3019a5102\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`packages\` DROP FOREIGN KEY \`FK_d7a071223f1211fbeff556bb8f8\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`packages\` DROP FOREIGN KEY \`FK_fb9642a8d6f50641861f54abae2\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`item_movements\` DROP FOREIGN KEY \`FK_a9e5525b65a740e352bcad33afd\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`items\` DROP FOREIGN KEY \`FK_99eba803010b34bfb69bd3e00d4\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`items\` DROP FOREIGN KEY \`FK_6e77b327d4c0d66f6ffb3d34be9\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`shipments\` DROP FOREIGN KEY \`FK_462cfcd31df4ad2008f72325541\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`shipments\` DROP FOREIGN KEY \`FK_3e86cbe03377cb3919cbb04c451\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`shipments\` DROP FOREIGN KEY \`FK_96de1112a6c3b62bf5b5fc151df\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_eb8007b3af4ab5212fe3776968\` ON \`items\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`items\` CHANGE \`siteId\` \`siteId\` int NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_eb8007b3af4ab5212fe3776968\` ON \`items\` (\`productId\`, \`siteId\`, \`status\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`items\` ADD CONSTRAINT \`FK_6e77b327d4c0d66f6ffb3d34be9\` FOREIGN KEY (\`siteId\`) REFERENCES \`sites\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` DROP COLUMN \`shipmentId\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`item_movements\` DROP COLUMN \`shipmentId\``,
    );
    await queryRunner.query(`ALTER TABLE \`items\` DROP COLUMN \`shipmentId\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_7c0bb77b028cd5d577195d44ad\` ON \`package_items\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_08d23b66219ec9e701af5bd57b\` ON \`package_items\``,
    );
    await queryRunner.query(`DROP TABLE \`package_items\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_054e141da0e8540ca2465fc6f0\` ON \`packages\``,
    );
    await queryRunner.query(`DROP TABLE \`packages\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_6a19baf6dd62cac42fbb40a518\` ON \`shipments\``,
    );
    await queryRunner.query(`DROP TABLE \`shipments\``);
  }
}
