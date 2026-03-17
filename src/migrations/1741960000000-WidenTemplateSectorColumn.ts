import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenTemplateSectorColumn1741960000000 implements MigrationInterface {
  name = 'WidenTemplateSectorColumn1741960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "communication_templates"
        ALTER COLUMN "sector" TYPE VARCHAR(500);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "communication_templates"
        ALTER COLUMN "sector" TYPE VARCHAR(50);
    `);
  }
}
