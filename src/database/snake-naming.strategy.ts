import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

/**
 * Converts a camelCase string to snake_case.
 *
 * @param str - The camelCase string to convert.
 * @returns The snake_case equivalent.
 *
 * @example
 * toSnakeCase('createdAt')   // → 'created_at'
 * toSnakeCase('salonId')     // → 'salon_id'
 */
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
  /**
   * Derives the table name from the entity class name or uses the custom name
   * if one is provided via the `@Entity('custom_name')` decorator.
   *
   * @param className  - The TypeScript entity class name.
   * @param customName - Optional explicit name from the `@Entity` decorator.
   * @returns The resolved snake_case table name.
   */
  tableName(className: string, customName?: string): string {
    return customName ?? toSnakeCase(className);
  }

  /**
   * Derives a column name from the entity property name, prefixed by any
   * embedded entity path segments.
   *
   * @param propertyName - The TypeScript property name.
   * @param customName   - Optional explicit name from the `@Column` decorator.
   * @param embeddeds    - Path segments for embedded entity properties.
   * @returns The resolved snake_case column name.
   */
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

  /**
   * Derives the relation name (used internally by TypeORM) from the property name.
   *
   * @param propertyName - The TypeScript relation property name.
   * @returns The snake_case relation name.
   */
  relationName(propertyName: string): string {
    return toSnakeCase(propertyName);
  }

  /**
   * Generates the foreign-key column name for a join column.
   *
   * @param relationName        - The name of the relation property.
   * @param referencedColumnName - The referenced primary-key column name.
   * @returns The snake_case join column name (e.g. `salon_id`).
   */
  joinColumnName(
    relationName: string,
    referencedColumnName: string,
  ): string {
    return toSnakeCase(relationName + '_' + referencedColumnName);
  }

  /**
   * Generates the name of the intermediate join table for a many-to-many relation.
   *
   * @param firstTableName       - Name of the owning entity's table.
   * @param secondTableName      - Name of the inverse entity's table.
   * @param _firstPropertyName   - Owning-side relation property (unused).
   * @param _secondPropertyName  - Inverse-side relation property (unused).
   * @returns The snake_case join table name.
   */
  joinTableName(
    firstTableName: string,
    secondTableName: string,
    _firstPropertyName: string,
    _secondPropertyName: string,
  ): string {
    return toSnakeCase(firstTableName + '_' + secondTableName);
  }

  /**
   * Generates a column name within a join table.
   *
   * @param tableName    - The owning table name.
   * @param propertyName - The relation property name on the entity.
   * @param columnName   - Optional explicit column name override.
   * @returns The snake_case join-table column name.
   */
  joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return toSnakeCase(tableName + '_' + (columnName ?? propertyName));
  }
}
