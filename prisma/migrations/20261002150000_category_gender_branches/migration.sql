-- Category becomes gender-scoped: every category now belongs to exactly one main
-- branch (Men / Women / Unisex), instead of being shared flat across both genders.
-- Existing rows are backfilled into three gender-scoped copies (Men/Women/Unisex,
-- same name+slug) and every Product's categoryId is repointed to the copy matching
-- its own (already-correct, untouched) gender — so no product changes gender here,
-- it just starts pointing at its own branch's category row.
--
-- The separate Collection / ProductCollection taxonomy is removed entirely — it
-- overlapped with Category and is no longer used anywhere in the app.

-- 1. Add the new column, nullable for now so we can backfill in steps.
ALTER TABLE "Category" ADD COLUMN "gender" "Gender";

-- 1b. Drop the old global slug-uniqueness now, before duplicating rows below gives
-- three rows the same slug (one per branch) — the per-branch replacement is added in
-- step 6, once every row has its final gender.
DROP INDEX IF EXISTS "Category_slug_key";

-- 2. Duplicate every existing category into a Women copy and a Unisex copy.
INSERT INTO "Category" ("id", "name", "slug", "position", "gender")
SELECT 'cat_' || substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 20), "name", "slug", "position", 'WOMEN'::"Gender"
FROM "Category"
WHERE "gender" IS NULL;

INSERT INTO "Category" ("id", "name", "slug", "position", "gender")
SELECT 'cat_' || substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 20), "name", "slug", "position", 'UNISEX'::"Gender"
FROM "Category"
WHERE "gender" IS NULL;

-- 3. The original rows become the Men copy.
UPDATE "Category" SET "gender" = 'MEN'::"Gender" WHERE "gender" IS NULL;

-- 4. Repoint every product at the category row matching its own gender (already
-- correct on Product, untouched here) with the same slug its old shared category had.
UPDATE "Product" p
SET "categoryId" = c."id"
FROM "Category" old, "Category" c
WHERE p."categoryId" = old."id"
  AND old."gender" = 'MEN'
  AND c."slug" = old."slug"
  AND c."gender" = p."gender";

-- 5. Lock the column down.
ALTER TABLE "Category" ALTER COLUMN "gender" SET NOT NULL;

-- 6. Add the new per-branch uniqueness (the old global one was already dropped in step 1b).
CREATE UNIQUE INDEX "Category_gender_slug_key" ON "Category"("gender", "slug");

-- 7. Drop the now-unused Collection taxonomy.
DROP TABLE IF EXISTS "ProductCollection";
DROP TABLE IF EXISTS "Collection";
