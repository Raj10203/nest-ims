import { MigrationInterface, QueryRunner } from 'typeorm';

export class StockRequestHandover1793264284021 implements MigrationInterface {
  name = 'StockRequestHandover1793264284021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` ADD \`requesterId\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` ADD CONSTRAINT \`FK_e362d6c456e0b17c3cfa12b7581\` FOREIGN KEY (\`requesterId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` DROP FOREIGN KEY \`FK_e362d6c456e0b17c3cfa12b7581\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_request_events\` DROP COLUMN \`requesterId\``,
    );
  }
}
