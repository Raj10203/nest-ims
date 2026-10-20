import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogs1792505354954 implements MigrationInterface {
  name = 'CreateAuditLogs1792505354954';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`audit_logs\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`action\` varchar(10) NOT NULL, \`entityType\` varchar(50) NOT NULL, \`entityId\` varchar(64) NOT NULL, \`oldValues\` json NULL, \`newValues\` json NULL, \`actorId\` int NULL, \`actorRole\` varchar(50) NULL, \`requestId\` varchar(64) NULL, \`ip\` varchar(45) NULL, INDEX \`IDX_678217ebecd415a0db47435d15\` (\`actorId\`, \`createdAt\`), INDEX \`IDX_8a28b714ccfb50403669aa9c45\` (\`entityType\`, \`entityId\`, \`createdAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_8a28b714ccfb50403669aa9c45\` ON \`audit_logs\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_678217ebecd415a0db47435d15\` ON \`audit_logs\``,
    );
    await queryRunner.query(`DROP TABLE \`audit_logs\``);
  }
}
