import dataSource from './data-source.js';
import { seed } from './seeds/seed.js';

// `npm run db:setup`: apply pending migrations, verify the entities match the
// schema, then (re)seed roles, permissions and the first super admin.
async function main() {
  await dataSource.initialize();
  try {
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    console.log(
      applied.length
        ? `Applied migrations: ${applied.map((m) => m.name).join(', ')}`
        : 'No pending migrations',
    );

    // Entities changed without a migration? Refuse to seed against a stale schema.
    const drift = await dataSource.driver.createSchemaBuilder().log();
    if (drift.upQueries.length) {
      console.error(
        'Schema is out of sync with the entities. Run `npm run migration:generate -- src/database/migrations/<Name>`, review it, then run db:setup again. Pending changes:',
      );
      for (const query of drift.upQueries) console.error(`  ${query.query}`);
      process.exitCode = 1;
      return;
    }

    await seed(dataSource);
    console.log('Seed complete');
  } finally {
    await dataSource.destroy();
  }
}

await main();
