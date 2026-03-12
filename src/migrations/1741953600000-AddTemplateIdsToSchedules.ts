import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTemplateIdsToSchedules1741953600000 implements MigrationInterface {
    name = 'AddTemplateIdsToSchedules1741953600000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "automation_schedules"
            ADD COLUMN IF NOT EXISTS "template_ids" text NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "automation_schedules"
            DROP COLUMN IF EXISTS "template_ids"
        `);
    }
}
