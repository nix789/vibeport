# Vibeport Social Project Rules

## Philosophy
- **No Metrics:** Never implement likes, follower counts, retweets, or engagement scores.
- **Local First:** All user data must reside in `./data` and be replicated via P2P only.
- **Styling:** Support "Chaos CSS" — users can fully override global styles on their own profile page.
- **Intentional Interactions:** Replace likes with "Stickers" or "Gifts" that cost local credit.
- **Discovery:** Webrings and Neighborhoods only. No global trending algorithm.

## Tech Stack
- **P2P Layer:** Hypercore Protocol + Hyperswarm (DHT-based peer discovery)
- **Database:** SQLite with CRDTs via `@crdt-sqlite` for offline-first sync
- **Frontend:** React (Vite) with sandboxed user CSS/HTML profile skins
- **Payments:** WebLN / Lightning Network for direct micropayments (no middleman)
- **Backend:** Node.js with no central server dependency

## File Layout
```
vibeport/
  node/         # Hypercore peer node (runs locally)
  frontend/     # React UI (Vite)
  data/         # ALL user data lives here (never upload to cloud)
  shared/       # Shared types/schemas
```

## Security Rules
- All user-supplied HTML/CSS must be sandboxed in a `<iframe sandbox>` — no `<script>` in profiles.
- CSS is sanitized via postcss before injection.
- Identity = Ed25519 keypair stored locally in `data/identity.json`. Never transmitted in plaintext.

## What NOT to build
- No central auth server
- No global feed
- No follower counts visible to others
- No read receipts or "seen" indicators
- No ads, no analytics, no telemetry
