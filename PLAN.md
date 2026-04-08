# Implementation Plan: Wish Lists Feature

Every wish must belong to a list. Users can create multiple lists (name + description). The dashboard groups wishes by list. Dev seed is updated accordingly.

---

## Status

- [x] Step 1 — Schema: add `lists` table, add `list_id` to `wishes`
- [x] Step 2 — `src/lib/lists.ts`: new library module
- [x] Step 3 — `src/lib/wishes.ts`: add `list_id` to types and queries
- [x] Step 4 — `src/test/helpers.ts`: add `createTestList` helper
- [x] Step 5 — Tests: update existing tests, add `lists.test.ts`
- [x] Step 6 — API: new `/api/lists` and `/api/lists/[id]` routes; update wish routes
- [x] Step 7 — `src/components/ListSelect.tsx`: reusable list dropdown
- [x] Step 8 — `src/app/lists/new/page.tsx`: list creation page
- [x] Step 9 — Wish forms: add list picker to new-wish and edit-wish forms
- [x] Step 10 — Dashboard: group wishes by list
- [x] Step 11 — Dev seed: restructure to create lists, assign wishes to them
- [x] Step 12 — Docs: `database.md`, `api.md`, `architecture.md`, `README.md`

All steps complete.
