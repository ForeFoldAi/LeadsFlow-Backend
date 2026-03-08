-- Migration: Add error_message column to communication_logs table
-- Run this when you see: column "error_message" of relation "communication_logs" does not exist

ALTER TABLE communication_logs
ADD COLUMN IF NOT EXISTS error_message TEXT NULL;
