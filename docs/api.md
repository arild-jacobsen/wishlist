# API Reference

All endpoints require authentication (valid JWT session cookie) unless noted.
Unauthenticated requests receive `401 Unauthorized`.

The API is consumed by the app's own Client Components — it is not a public API.

---

## Authentication

### `POST /api/auth/request-otp`

Triggers an OTP code to be sent to the given email. Always returns `{ ok: true }`
regardless of whether the email is on the whitelist (to avoid leaking which
emails are valid).

**Does not require authentication.**

**Request body:**
```json
{ "email": "user@example.com" }
```

**Response:**
```json
{ "ok": true }
```

---

### `GET /api/auth/[...nextauth]`
### `POST /api/auth/[...nextauth]`

NextAuth's internal endpoints. Handles session cookies, CSRF, and sign-out.
These are consumed by NextAuth's client library — do not call them directly.

---

## Users

### `GET /api/users`

Returns all registered users with their wish counts.

**Response:**
```json
[
  { "id": 1, "email": "jacobsen.arild@gmail.com", "wishCount": 3 },
  { "id": 2, "email": "arild.jacobsen@outlook.com", "wishCount": 1 }
]
```

---

### `GET /api/users/[id]/wishes`

Returns all wishes for a specific user, with claim information attached.
Claim visibility follows the privacy model: if the requesting user is the
wish owner, `claims` will be `null` on each wish.

**Response:**
```json
[
  {
    "id": 5,
    "user_id": 2,
    "name": "New bicycle",
    "description": null,
    "links": [],
    "rating": "Would love to get this",
    "created_at": "2024-01-15T10:00:00.000Z",
    "claims": [
      { "id": 1, "wish_id": 5, "user_id": 1, "created_at": "..." }
    ]
  }
]
```

---

## Wishes

### `GET /api/wishes`

Returns the current user's own wishes (no claim info attached).

**Response:** Array of `Wish` objects (see shape above, without `claims`).

---

### `POST /api/wishes`

Creates a new wish owned by the current user.

**Request body:**
```json
{
  "name": "Coffee machine",
  "description": "The one with the milk frother",
  "links": ["https://example.com/product"],
  "rating": "Would love to get this"
}
```

`name` and `rating` are required. `description` and `links` are optional.

**Valid rating values:**
- `"It'd be nice"`
- `"Would make me happy"`
- `"Would love to get this"`

**Response:** `201 Created` with the created `Wish` object.

**Error responses:**
- `400 Bad Request` — invalid rating, empty name

---

### `GET /api/wishes/[id]`

Returns a single wish by ID.

**Response:** `Wish` object, or `404 Not Found`.

---

### `PATCH /api/wishes/[id]`

Partially updates a wish. Only the wish owner can do this.
All fields are optional — omit any field to keep its current value.

**Request body:** (all fields optional)
```json
{
  "name": "Updated name",
  "description": "Updated description",
  "links": ["https://new-link.com"],
  "rating": "Would make me happy"
}
```

**Response:** Updated `Wish` object.

**Error responses:**
- `400 Bad Request` — not the owner, invalid rating, empty name

---

### `DELETE /api/wishes/[id]`

Deletes a wish. Only the wish owner can do this. Cascades to delete all
associated claims and secret comments.

**Response:** `204 No Content`.

**Error responses:**
- `400 Bad Request` — not the owner or wish not found

---

## Claims

### `GET /api/wishes/[id]/claim`

Returns claims on a wish. If the requesting user is the wish owner, returns
`403 Forbidden` (the owner must not see who claimed their wish).

**Response for non-owners:**
```json
[
  { "id": 1, "wish_id": 5, "user_id": 1, "created_at": "2024-01-15T..." }
]
```

**Error responses:**
- `403 Forbidden` — viewer is the wish owner

---

### `POST /api/wishes/[id]/claim`

Marks the current user as intending to buy this wish.

**No request body required.**

**Response:** `201 Created` with the new `Claim` object.

**Error responses:**
- `400 Bad Request` — user is the wish owner, or already claimed

---

### `DELETE /api/wishes/[id]/claim`

Removes the current user's claim on a wish. Safe to call even if no claim exists.

**Response:** `204 No Content`.

---

## Secret Comments

### `GET /api/wishes/[id]/comments`

Returns secret comments on a wish. If the requesting user is the wish owner,
returns `403 Forbidden`.

**Response for non-owners:**
```json
[
  {
    "id": 1,
    "wish_id": 5,
    "user_id": 2,
    "content": "I already ordered it!",
    "created_at": "2024-01-15T..."
  }
]
```

**Error responses:**
- `403 Forbidden` — viewer is the wish owner

---

---

## Dev utilities

These endpoints are only available when `NODE_ENV !== 'production'`. They return
`404 Not Found` in production.

### `POST /api/dev/seed`

Creates a fixed set of dummy users (`alice@example.com`, `bob@example.com`,
`carol@example.com`) each with three wishes spanning all three rating levels.
Idempotent: skips users that already exist.

**Does not require authentication.**

**Response:** `201 Created`
```json
{
  "created": [{ "email": "alice@example.com", "userId": 4, "wishesCreated": 3 }],
  "skipped": ["bob@example.com"]
}
```

---

### `DELETE /api/dev/seed`

Removes all users whose email ends in `@example.com`, along with their wishes,
claims, and secret comments (cascade).

**Does not require authentication.**

**Response:**
```json
{ "deletedUsers": 3 }
```

---

### `POST /api/wishes/[id]/comments`

Adds a secret comment to a wish. The wish owner cannot post comments.

**Request body:**
```json
{ "content": "Should we go halves on this?" }
```

`content` must be a non-empty string.

**Response:** `201 Created` with the new `SecretComment` object.

**Error responses:**
- `400 Bad Request` — user is the wish owner, or empty content
