import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSectorsToCommunicationTemplates1742040000000 implements MigrationInterface {
  name = 'AddSectorsToCommunicationTemplates1742040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "communication_templates"
        ADD COLUMN IF NOT EXISTS "sectors" jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "communication_templates" DROP COLUMN IF EXISTS "sectors";
    `);
  }
}
