import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Maps camelCase TypeScript property names → snake_case DB column names.
 * Register in DatabaseConfig: namingStrategy: new SnakeNamingStrategy()
 *
 * Examples:
 *   createdAt      → created_at
 *   salonId        → salon_id
 *   passwordHash   → password_hash
 */
export class SnakeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  tableName(className: string, customName?: string): string {
    return customName ?? toSnakeCase(className);
  }

  columnName(
    propertyName: string,
    customName?: string,
    embeddeds: string[] = [],
  ): string {
    const prefix = embeddeds.reduce(
      (acc, e) => acc + toSnakeCase(e) + '_',
      '',
    );
    return prefix + (customName ?? toSnakeCase(propertyName));
  }

  relationName(propertyName: string): string {
    return toSnakeCase(propertyName);
  }

  joinColumnName(
    relationName: string,
    referencedColumnName: string,
  ): string {
    return toSnakeCase(relationName + '_' + referencedColumnName);
  }

  joinTableName(
    firstTableName: string,
    secondTableName: string,
    _firstPropertyName: string,
    _secondPropertyName: string,
  ): string {
    return toSnakeCase(firstTableName + '_' + secondTableName);
  }

  joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return toSnakeCase(tableName + '_' + (columnName ?? propertyName));
  }
}
