import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssignedToUserIdToLeads1741867200000 implements MigrationInterface {
    name = 'AddAssignedToUserIdToLeads1741867200000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "leads"
            ADD COLUMN IF NOT EXISTS "assigned_to_user_id" varchar(255) NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "leads"
            DROP COLUMN IF EXISTS "assigned_to_user_id"
        `);
    }
}
