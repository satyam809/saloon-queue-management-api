import { Module } from '@nestjs/common';
import { DatabaseConfig } from './database.config';

/**
 * Configuration module that provides and exports `DatabaseConfig`.
 *
 * `DatabaseConfig` implements `TypeOrmOptionsFactory` and is used by
 * `TypeOrmModule.forRootAsync` in `AppModule` to build the TypeORM connection
 * options at runtime from the NestJS `ConfigService`.
 *
 * Other modules that need direct access to `DatabaseConfig` (e.g. for
 * migration tooling) should import this module.
 */
@Module({
  providers: [DatabaseConfig],
  exports: [DatabaseConfig],
})
export class ConfigModule {}
