import { registerAs } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from '@database/snake-naming.strategy';

/**
 * Database configuration namespace (`database.*`).
 *
 * Values are resolved from environment variables with safe defaults:
 *  - `DB_HOST`     → `database.host`     (default: `"localhost"`)
 *  - `DB_PORT`     → `database.port`     (default: `3306`)
 *  - `DB_USERNAME` → `database.username` (default: `"root"`)
 *  - `DB_PASSWORD` → `database.password` (default: empty string)
 *  - `DB_NAME`     → `database.name`     (default: `"saloon_queue"`)
 */
export default registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  name: process.env.DB_NAME ?? 'saloon_queue',
}));

/**
 * Injectable factory that builds TypeORM connection options at runtime.
 *
 * Used by `TypeOrmModule.forRootAsync({ useClass: DatabaseConfig })` in
 * `AppModule`. Connection settings are read from the NestJS `ConfigService`
 * so they benefit from the same validation and caching as all other config.
 *
 * Notable runtime behaviour:
 *  - `synchronize` is enabled only in development to avoid accidental
 *    schema mutations in staging/production.
 *  - Queries exceeding 1 000 ms are logged regardless of environment.
 *  - Column and table names are mapped to snake_case via `SnakeNamingStrategy`.
 *  - The connection pool allows up to 50 connections per process with an
 *    unlimited queue and a 10 s connect timeout.
 */
@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  /**
   * Constructs and returns the TypeORM module options.
   *
   * @returns A fully-populated `TypeOrmModuleOptions` object ready to be
   *          consumed by `TypeOrmModule.forRootAsync`.
   */
  createTypeOrmOptions(): TypeOrmModuleOptions {
    const isDev = this.configService.get<string>('app.env') === 'development';

    return {
      type: 'mysql',
      host:     this.configService.get<string>('database.host'),
      port:     this.configService.get<number>('database.port'),
      username: this.configService.get<string>('database.username'),
      password: this.configService.get<string>('database.password'),
      database: this.configService.get<string>('database.name'),
      entities:   [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
      synchronize: false,
      // In production log only slow queries (≥ 1 s).  In dev log everything.
      logging:     isDev ? true : ['warn', 'error'],
      maxQueryExecutionTime: 1000,   // ms — log any query that exceeds this
      namingStrategy: new SnakeNamingStrategy(),
      timezone: 'Z',
      extra: {
        // Pool sizing: enough headroom for 10 k concurrent requests spread
        // across multiple instances.  Each NestJS process holds up to 50
        // persistent connections; with 4 instances that's 200 total against
        // MySQL's default max_connections=151 → tune DB server accordingly.
        connectionLimit:  50,
        waitForConnections: true,
        // Max requests queued waiting for a free connection before failing.
        // 0 = unlimited queue (requests never get a "No connections available"
        // error but may time out via the TimeoutInterceptor instead).
        queueLimit: 0,
        // Bail on a connection attempt after 10 s rather than hanging forever.
        connectTimeout: 10_000,
        // Keep idle connections alive so the OS doesn't silently drop them.
        enableKeepAlive: true,
        keepAliveInitialDelay: 30_000, // ms before the first keepalive probe
      },
    };
  }
}
