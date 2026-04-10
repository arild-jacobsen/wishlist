# Wishlist

A private app for sharing wish lists with close friends and family. You can see
each other's wishes, quietly claim the ones you plan to buy, and leave secret
comments to coordinate — all without spoiling any surprises.

## Who has access

Access is invite-only. Only the following email addresses can log in:

- jacobsen.arild@gmail.com
- arild.jacobsen@outlook.com

To add someone new, see the developer docs (`docs/auth.md`).

## Logging in

There are two ways to sign in:

**Google (recommended):** Click "Sign in with Google" and complete the Google sign-in flow. No codes required.

**One-time code:** Enter your email address and you'll receive a 6-digit code. Enter the code to sign in. Codes expire after 15 minutes.

> **Note:** Email delivery is not yet wired up. During development, the one-time code is
> printed to the server's console log instead of being emailed.

---

## Using the app

### The dashboard

After logging in you land on the dashboard. It shows everyone's wish lists in
one place, grouped by list. You can see:

- **Your own lists** — under "My wish lists", each showing their wishes
- **Other people's lists** — under their email address
- A **"Claimed"** badge on any wish that someone has already volunteered to buy
  *(you won't see this badge on your own wishes — the surprise is protected)*

Click any wish to see its full details.

### Creating a list

Before adding wishes, create at least one list to organise them into. Click
**+ New list** in the top-right corner and give it a name (e.g. "Birthday",
"Kitchen", "Tech"). The description is optional.

### Adding a wish

Click **+ Add wish** in the top-right corner. Fill in:

| Field | Required | Description |
|---|---|---|
| List | Yes | Which of your lists this wish belongs to |
| Name | Yes | What you want, e.g. "New running shoes" |
| Description | No | Extra details to help people find the right thing |
| Links | No | One URL per line — product pages, wishlists, etc. |
| How much do you want this? | Yes | Choose a rating (see below) |

If you haven't created a list yet, the form will prompt you to create one first.

**Wish ratings:**

| Rating | Meaning |
|---|---|
| It'd be nice | A low-priority or casual wish |
| Would make me happy | A genuine wish you'd be pleased to receive |
| Would love to get this | Your top picks |

Click **Add wish** to save.

### Editing or deleting a wish

Open one of your own wishes and click **Edit**. You can change any field and
save, or delete the wish entirely.

You can only edit or delete your own wishes.

### Claiming a wish

When viewing someone else's wish, you'll see a **"I'll get this!"** button. Click
it to let others know you're planning to buy that gift.

- The wish owner **cannot** see that their wish has been claimed — they'll be
  surprised.
- Everyone else **can** see the claim, so you don't accidentally double-up on
  the same gift.

Changed your mind? Click **Remove my claim** to unclaim it.

### Secret comments

On anyone else's wish you'll find a **Secret comments** section. Use it to
coordinate privately — for example, to suggest going halves on a gift or to
share shipping details.

- The wish owner **cannot** see these comments.
- Everyone else **can** read and post them.

Type your message and click **Send**.

### Signing out

Click **Sign out** in the top-right corner of the dashboard.

---

## Running the app locally

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

When you request a login code in development, look for the code in the terminal
where `npm run dev` is running:

```
[OTP] Sending code 483921 to you@example.com
```

## Running the tests

```bash
npm test
```
