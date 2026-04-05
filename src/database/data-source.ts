import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Standalone TypeORM `DataSource` used exclusively by the TypeORM CLI for
 * migration commands (e.g. `typeorm migration:run`, `migration:generate`).
 *
 * This data source operates independently of the NestJS DI container and
 * reads connection parameters directly from the `.env` file via `dotenv`.
 *
 * Key differences from the runtime `DatabaseConfig`:
 *  - `synchronize` is always `false` — migrations are the only schema
 *    change mechanism outside of development.
 *  - No pool tuning or custom options — CLI commands are single-shot.
 *
 * @example
 * # Run all pending migrations
 * npx typeorm migration:run -d src/database/data-source.ts
 */
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'saloon_queue',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
