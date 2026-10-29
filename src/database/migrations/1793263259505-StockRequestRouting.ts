import { MigrationInterface, QueryRunner } from 'typeorm';

export class StockRequestRouting1793263259505 implements MigrationInterface {
  name = 'StockRequestRouting1793263259505';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`shipments\` ADD \`fromSiteId\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_requests\` ADD \`fromSiteId\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_requests\` ADD \`assigneeId\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` ADD \`fromSiteId\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` ADD \`toSiteId\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` ADD \`assigneeId\` int NULL`,
    );
    // Nullable so a version still serving during the deploy can insert rows
    // without it; everything so far left from headquarters. A later release
    // backfills those rows again and makes the columns NOT NULL.
    for (const table of ['shipments', 'stock_requests']) {
      await queryRunner.query(
        `UPDATE \`${table}\` SET \`fromSiteId\` = (SELECT \`id\` FROM \`sites\` WHERE \`type\` = 'hq' LIMIT 1) WHERE \`fromSiteId\` IS NULL`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE \`shipments\` ADD CONSTRAINT \`FK_a3fc42e8dcdd6ff4ca6724cd129\` FOREIGN KEY (\`fromSiteId\`) REFERENCES \`sites\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_requests\` ADD CONSTRAINT \`FK_01e7490ab029186d71c45e3c988\` FOREIGN KEY (\`fromSiteId\`) REFERENCES \`sites\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_requests\` ADD CONSTRAINT \`FK_ccfa26147dd1bfc1177a81bb3b3\` FOREIGN KEY (\`assigneeId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` ADD CONSTRAINT \`FK_673258762fb2014973ead88c1aa\` FOREIGN KEY (\`fromSiteId\`) REFERENCES \`sites\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` ADD CONSTRAINT \`FK_6f1de7acb2d2a0b156036f232ba\` FOREIGN KEY (\`toSiteId\`) REFERENCES \`sites\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` ADD CONSTRAINT \`FK_39b488bf7a300a9f9fd397813cd\` FOREIGN KEY (\`assigneeId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` DROP FOREIGN KEY \`FK_39b488bf7a300a9f9fd397813cd\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` DROP FOREIGN KEY \`FK_6f1de7acb2d2a0b156036f232ba\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` DROP FOREIGN KEY \`FK_673258762fb2014973ead88c1aa\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_requests\` DROP FOREIGN KEY \`FK_ccfa26147dd1bfc1177a81bb3b3\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_requests\` DROP FOREIGN KEY \`FK_01e7490ab029186d71c45e3c988\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`shipments\` DROP FOREIGN KEY \`FK_a3fc42e8dcdd6ff4ca6724cd129\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` DROP COLUMN \`assigneeId\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` DROP COLUMN \`toSiteId\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` DROP COLUMN \`fromSiteId\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_requests\` DROP COLUMN \`assigneeId\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_requests\` DROP COLUMN \`fromSiteId\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`shipments\` DROP COLUMN \`fromSiteId\``,
    );
  }
}
