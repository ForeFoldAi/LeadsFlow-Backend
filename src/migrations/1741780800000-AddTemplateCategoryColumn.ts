import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTemplateCategoryColumn1741780800000 implements MigrationInterface {
  name = 'AddTemplateCategoryColumn1741780800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."communication_templates_category_enum"
          AS ENUM ('general', 'focused_template', 'followup_template');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "communication_templates"
        ADD COLUMN IF NOT EXISTS "category"
          "public"."communication_templates_category_enum"
          NOT NULL DEFAULT 'general';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "communication_templates" DROP COLUMN IF EXISTS "category";
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."communication_templates_category_enum";
    `);
  }
}
