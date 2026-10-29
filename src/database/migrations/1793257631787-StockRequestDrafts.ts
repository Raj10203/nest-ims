import { MigrationInterface, QueryRunner } from 'typeorm';

export class StockRequestDrafts1793257631787 implements MigrationInterface {
  name = 'StockRequestDrafts1793257631787';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`stock_requests\` ADD \`requestedAt\` datetime NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_lines\` ADD \`note\` varchar(1000) NULL`,
    );
    // Requests before drafts were sent when they were created.
    await queryRunner.query(
      `UPDATE \`stock_requests\` SET \`requestedAt\` = \`createdAt\` WHERE \`requestedById\` IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`stock_request_lines\` DROP COLUMN \`note\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_requests\` DROP COLUMN \`requestedAt\``,
    );
  }
}
