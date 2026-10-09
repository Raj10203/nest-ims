import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { dbEnv } from '../config/db-env.js';

// Shared by the Nest app (TypeOrmModule) and the TypeORM CLI (migrations).
export const dataSourceOptions: DataSourceOptions = {
  type: 'mysql',
  host: dbEnv.DB_HOST,
  port: dbEnv.DB_PORT,
  username: dbEnv.DB_USER,
  password: dbEnv.DB_PASSWORD,
  database: dbEnv.DB_NAME,
  ssl: dbEnv.DB_SSL
    ? {
        rejectUnauthorized: true,
        ...(dbEnv.DB_SSL_CA ? { ca: readFileSync(dbEnv.DB_SSL_CA) } : {}),
      }
    : undefined,
  entities: [join(import.meta.dirname, '..', 'entities', '*.entity.js')],
  migrations: [join(import.meta.dirname, 'migrations', '*.js')],
  synchronize: false, // schema changes only through migrations
};

export default new DataSource(dataSourceOptions);
