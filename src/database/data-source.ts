import { join } from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { env } from '../config/env.js';

// Shared by the Nest app (TypeOrmModule) and the TypeORM CLI (migrations).
export const dataSourceOptions: DataSourceOptions = {
  type: 'mysql',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  entities: [join(import.meta.dirname, '..', 'entities', '*.entity.js')],
  migrations: [join(import.meta.dirname, 'migrations', '*.js')],
  synchronize: false, // schema changes only through migrations
};

export default new DataSource(dataSourceOptions);
