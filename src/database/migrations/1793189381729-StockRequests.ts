import { MigrationInterface, QueryRunner } from 'typeorm';

export class StockRequests1793189381729 implements MigrationInterface {
  name = 'StockRequests1793189381729';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`stock_requests\` (\`id\` int NOT NULL AUTO_INCREMENT, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`siteId\` int NOT NULL, \`status\` varchar(20) NOT NULL, \`note\` varchar(1000) NULL, \`neededBy\` date NULL, \`requestedById\` int NULL, \`reviewedById\` int NULL, \`reviewedAt\` datetime NULL, \`approvedById\` int NULL, \`approvedAt\` datetime NULL, \`closedById\` int NULL, \`closedAt\` datetime NULL, INDEX \`IDX_89428bba83b10528ccc3102341\` (\`status\`, \`siteId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`stock_request_comments\` (\`id\` int NOT NULL AUTO_INCREMENT, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`requestId\` int NOT NULL, \`parentId\` int NULL, \`body\` varchar(2000) NOT NULL, \`authorId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`stock_request_events\` (\`id\` int NOT NULL AUTO_INCREMENT, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`requestId\` int NOT NULL, \`action\` varchar(30) NOT NULL, \`status\` varchar(20) NOT NULL, \`productId\` int NULL, \`quantityBefore\` int UNSIGNED NULL, \`quantityAfter\` int UNSIGNED NULL, \`note\` varchar(1000) NULL, \`performedById\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`stock_request_lines\` (\`id\` int NOT NULL AUTO_INCREMENT, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`requestId\` int NOT NULL, \`productId\` int NOT NULL, \`requestedQuantity\` int UNSIGNED NOT NULL, \`quantity\` int UNSIGNED NOT NULL, UNIQUE INDEX \`IDX_57ad42e97589a4eb7bc04af31b\` (\`requestId\`, \`productId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_requests\` ADD CONSTRAINT \`FK_2519a46d09d52f006e25191e972\` FOREIGN KEY (\`siteId\`) REFERENCES \`sites\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_requests\` ADD CONSTRAINT \`FK_77c2437279da830381bf63522f4\` FOREIGN KEY (\`requestedById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_requests\` ADD CONSTRAINT \`FK_93164e4b09fd860cada458a634f\` FOREIGN KEY (\`reviewedById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_requests\` ADD CONSTRAINT \`FK_05a54e2790ac3aa937c80972d26\` FOREIGN KEY (\`approvedById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_requests\` ADD CONSTRAINT \`FK_53850af73eb9496a6d33acd21c3\` FOREIGN KEY (\`closedById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_comments\` ADD CONSTRAINT \`FK_a1b9c90fbcb518a1b4621928c1b\` FOREIGN KEY (\`requestId\`) REFERENCES \`stock_requests\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_comments\` ADD CONSTRAINT \`FK_548f9f65d9ceb2603a1b9b7402d\` FOREIGN KEY (\`parentId\`) REFERENCES \`stock_request_comments\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_comments\` ADD CONSTRAINT \`FK_57c6be498ba04453590c4c8caa7\` FOREIGN KEY (\`authorId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` ADD CONSTRAINT \`FK_e89998d00bbe91bf16d092b2999\` FOREIGN KEY (\`requestId\`) REFERENCES \`stock_requests\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` ADD CONSTRAINT \`FK_197688250cab0b9df8a13ac026e\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` ADD CONSTRAINT \`FK_acf707860e341913975f7fef78f\` FOREIGN KEY (\`performedById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_lines\` ADD CONSTRAINT \`FK_6603e1df11c7bc9abd768bf9c07\` FOREIGN KEY (\`requestId\`) REFERENCES \`stock_requests\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_lines\` ADD CONSTRAINT \`FK_82b6a8fc69064825210af83957b\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`stock_request_lines\` DROP FOREIGN KEY \`FK_82b6a8fc69064825210af83957b\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_lines\` DROP FOREIGN KEY \`FK_6603e1df11c7bc9abd768bf9c07\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` DROP FOREIGN KEY \`FK_acf707860e341913975f7fef78f\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` DROP FOREIGN KEY \`FK_197688250cab0b9df8a13ac026e\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` DROP FOREIGN KEY \`FK_e89998d00bbe91bf16d092b2999\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_comments\` DROP FOREIGN KEY \`FK_57c6be498ba04453590c4c8caa7\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_comments\` DROP FOREIGN KEY \`FK_548f9f65d9ceb2603a1b9b7402d\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_comments\` DROP FOREIGN KEY \`FK_a1b9c90fbcb518a1b4621928c1b\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_requests\` DROP FOREIGN KEY \`FK_53850af73eb9496a6d33acd21c3\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_requests\` DROP FOREIGN KEY \`FK_05a54e2790ac3aa937c80972d26\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_requests\` DROP FOREIGN KEY \`FK_93164e4b09fd860cada458a634f\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_requests\` DROP FOREIGN KEY \`FK_77c2437279da830381bf63522f4\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_requests\` DROP FOREIGN KEY \`FK_2519a46d09d52f006e25191e972\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_57ad42e97589a4eb7bc04af31b\` ON \`stock_request_lines\``,
    );
    await queryRunner.query(`DROP TABLE \`stock_request_lines\``);
    await queryRunner.query(`DROP TABLE \`stock_request_events\``);
    await queryRunner.query(`DROP TABLE \`stock_request_comments\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_89428bba83b10528ccc3102341\` ON \`stock_requests\``,
    );
    await queryRunner.query(`DROP TABLE \`stock_requests\``);
  }
}
