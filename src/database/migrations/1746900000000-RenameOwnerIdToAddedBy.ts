import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameOwnerIdToAddedBy1746900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the partially-added added_by column if the failed synchronize created it
    const table = await queryRunner.getTable('salons');
    if (table?.findColumnByName('added_by')) {
      await queryRunner.dropColumn('salons', 'added_by');
    }

    // Drop any FK that TypeORM placed on owner_id so the rename can proceed
    const fks = table?.foreignKeys.filter(fk => fk.columnNames.includes('owner_id')) ?? [];
    for (const fk of fks) {
      await queryRunner.dropForeignKey('salons', fk);
    }

    // Drop old index on owner_id
    const indexes = table?.indices.filter(idx => idx.columnNames.includes('owner_id')) ?? [];
    for (const idx of indexes) {
      await queryRunner.dropIndex('salons', idx);
    }

    // Rename the column — data is preserved
    await queryRunner.renameColumn('salons', 'owner_id', 'added_by');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameColumn('salons', 'added_by', 'owner_id');
  }
}
