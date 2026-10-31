-- Database Migration: Add GARAGE to ShopType enum and remove UNIT
-- Timestamp: 2026-10-29
-- Entity: shops (ShopType enum)
-- Description:
--   1. Create replacement enum type ShopType_new containing GARAGE and excluding UNIT
--   2. Drop default constraint on shops.type
--   3. Migrate existing rows where type = 'UNIT' to 'GARAGE'
--   4. Alter shops.type to use ShopType_new with new default 'GARAGE'
--   5. Drop old ShopType and rename ShopType_new to ShopType

CREATE TYPE "ShopType_new" AS ENUM (
  'KIOSK',
  'OFFICE',
  'RESTAURANT',
  'COFFEE',
  'MART',
  'RETAIL',
  'PHARMACY',
  'SALON',
  'FITNESS',
  'CLINIC',
  'STORAGE',
  'GARAGE',
  'OTHER'
);

ALTER TABLE "shops" ALTER COLUMN "type" DROP DEFAULT;

UPDATE "shops"
SET "type" = 'GARAGE'
WHERE "type"::text = 'UNIT';

ALTER TABLE "shops"
  ALTER COLUMN "type" TYPE "ShopType_new"
  USING (
    CASE
      WHEN "type"::text = 'UNIT' THEN 'GARAGE'::"ShopType_new"
      ELSE "type"::text::"ShopType_new"
    END
  );

ALTER TABLE "shops" ALTER COLUMN "type" SET DEFAULT 'GARAGE'::"ShopType_new";

DROP TYPE "ShopType";
ALTER TYPE "ShopType_new" RENAME TO "ShopType";
