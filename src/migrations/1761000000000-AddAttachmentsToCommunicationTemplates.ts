import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAttachmentsToCommunicationTemplates1761000000000 implements MigrationInterface {
  name = 'AddAttachmentsToCommunicationTemplates1761000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "communication_templates"
        ADD COLUMN IF NOT EXISTS "attachments" jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "communication_templates" DROP COLUMN IF EXISTS "attachments";
    `);
  }
}
