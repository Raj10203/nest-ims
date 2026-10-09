import { CommandFactory } from 'nest-commander';
import { CliModule } from './cli.module.js';

// Entry point for custom commands, the CLI counterpart of main.ts.
// Usage: node dist/cli/cli.js <command> [options]   (e.g. `seed`, `seed --help`)
await CommandFactory.run(CliModule, ['warn', 'error']);
