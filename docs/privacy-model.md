# Privacy Model

The core feature of this app is that **wish owners are kept in the dark** about
who plans to buy their wishes and what others are saying about them. This section
explains how that is enforced.

## The two protected pieces of information

1. **Claims** — which user has marked a wish as "I'll get this"
2. **Secret comments** — messages left by non-owners to coordinate privately

In both cases, the wish owner must never see this data, while every other
authenticated user can.

## Where enforcement lives

Enforcement is in the **business logic layer** (`src/lib/`), not the database
and not the UI. This means:

- The database *can* store and return this data for anyone.
- The TypeScript functions in `src/lib/claims.ts` and `src/lib/comments.ts`
  check the viewer's identity and return `null` when the viewer is the owner.
- API route handlers pass the result through as-is: `null` becomes `403`.
- UI components are only rendered for non-owners (controlled by `isOwner` in
  the server component).

The privacy check is therefore defence-in-depth:
- **Library level:** `getClaimsForWish` / `getSecretComments` return `null`
- **API level:** route handlers return `403 Forbidden` when result is `null`
- **UI level:** claim/comment sections are not rendered for owners

## The `null` return convention

Both `getClaimsForWish` and `getSecretComments` have return type
`T[] | null`:

```typescript
// Returns the list of claims, or null if the viewer is the wish owner
function getClaimsForWish(db, wishId, viewerId): Claim[] | null
```

`null` means "this viewer is not allowed to see this data".
`[]` (empty array) means "allowed to see, but nothing here yet".

Callers **must** handle both cases distinctly. In route handlers:

```typescript
const claims = getClaimsForWish(db, wishId, viewerId);
if (claims === null) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
return NextResponse.json(claims);
```

In server components:

```typescript
const isOwner = wish.user_id === viewerId;
// ...
{!isOwner && (
  <ClaimsSection claims={claims} />
)}
```

## What the owner CAN see

The wish owner can see:
- Their own wish details (name, description, links, rating)
- That a wish exists in the UI
- Their own wish in the dashboard list (but without the "Claimed" badge)

The wish owner cannot see:
- Any claims on their wishes
- Any secret comments on their wishes
- The "Claimed" badge on their own wishes in the dashboard

## Adding a new user type (e.g. admin)

If a future requirement adds an admin role who can see everything, the correct
place to add that logic is in `getClaimsForWish` and `getSecretComments` — check
whether `viewerId` belongs to an admin and skip the owner check if so. Do not
add this check in the UI or the API route — keep all visibility logic in the
library functions.

## Preventing owners from writing

Beyond reading, owners are also prevented from *writing* certain data:

- `claimWish` throws if `wish.user_id === claimerId`
- `addSecretComment` throws if `wish.user_id === commenterId`

These checks also live in the library functions so they apply everywhere the
functions are called, not just via specific API routes.
