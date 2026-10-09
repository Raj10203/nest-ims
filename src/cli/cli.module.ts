import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from '../database/data-source.js';
import { SeedCommand } from './seed.command.js';

// Only what commands need: the database connection and the commands themselves.
// Register every new command class in `providers`.
@Module({
  imports: [TypeOrmModule.forRoot(dataSourceOptions)],
  providers: [SeedCommand],
})
export class CliModule {}
