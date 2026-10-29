-- P14-06: chat + query attachments (additive). Original filename on the upload intent + media row,
-- media ids on chat messages (query_messages.attachments already exists).
ALTER TABLE "files_upload_intents" ADD COLUMN IF NOT EXISTS "filename" text;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "original_name" text;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachments" uuid[] DEFAULT '{}'::uuid[] NOT NULL;
