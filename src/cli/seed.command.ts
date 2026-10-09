import { Command, CommandRunner, Option } from 'nest-commander';
import { DataSource } from 'typeorm';
import { ROLE_PERMISSIONS } from '../database/seeds/role-permissions.js';
import { seed } from '../database/seeds/seed.js';

interface SeedOptions {
  dryRun?: boolean;
}

// Run after every deployment's migrations: `node dist/cli/cli.js seed`.
// Idempotent, so repeating it is safe.
@Command({
  name: 'seed',
  description:
    'Sync roles and permissions to role-permissions.ts and create the first super admin if missing',
})
export class SeedCommand extends CommandRunner {
  // DataSource comes from TypeOrmModule via normal dependency injection.
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async run(_args: string[], options: SeedOptions): Promise<void> {
    if (options.dryRun) {
      for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
        console.log(
          `${role}: ${permissions.map((p) => p.join(':')).join(', ')}`,
        );
      }
      return;
    }
    await seed(this.dataSource);
    console.log('Seed complete');
  }

  @Option({
    flags: '--dry-run',
    description: 'Print the permissions that would be applied, change nothing',
  })
  parseDryRun(): boolean {
    return true;
  }
}
