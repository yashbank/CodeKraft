-- D17-02: users.display_currency NULL = "no own choice" (follow the admin default currency).
-- The old NOT NULL DEFAULT 'INR' made every account look like it had picked INR. Additive/relaxing.
ALTER TABLE "users" ALTER COLUMN "display_currency" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "display_currency" DROP DEFAULT;
UPDATE "users" SET "display_currency" = NULL WHERE "display_currency" = 'INR';
