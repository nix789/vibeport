# Vibeport

> Your Port. Your Vibe. Your People.

A local-first, hybrid P2P social network. No central servers. No algorithms. No ads. No follower counts. Your data lives on your device and replicates directly to your friends — with optional relay nodes for offline delivery.

Inspired by the creative chaos of early MySpace and the protocol philosophy of Nostr.

---

## What makes it different

- **You own the node** — your identity is an Ed25519 keypair generated on your machine. No email, no password, no account.
- **No metrics** — likes are replaced by intentional Stickers. There are no follower counts, no retweet counts, no engagement scores.
- **Chaos CSS** — your profile page is yours to style completely, like MySpace in its prime.
- **Relay network** — like Nostr, anyone can run a relay. Relays cache and forward signed events but cannot read, modify, or censor them.
- **Media with expiry** — image/video posts auto-delete from the relay after 72 hours.

---

## Architecture

```
┌─────────────────────────────────────┐
│  Your Device                        │
│  ┌─────────┐   ┌──────────────────┐ │
│  │ React   │◄──│ Local Node       │ │
│  │ Frontend│   │ (port 7331)      │ │
│  └─────────┘   │ Hypercore + DHT  │ │
│                └────────┬─────────┘ │
└─────────────────────────┼───────────┘
                          │ WebSocket
              ┌───────────▼───────────┐
              │  Relay (your VPS)     │
              │  SQLite event cache   │
              │  Ed25519 verified     │
              │  ws://...:4444        │
              └───────────────────────┘
                          │
              ┌───────────▼───────────┐
              │  Friend's Device      │
              │  (direct or via relay)│
              └───────────────────────┘
```

- **Direct P2P** via Hyperswarm DHT when both peers are online
- **Relay-assisted** delivery when a peer is offline (events are signed and verified — relay cannot forge them)

---

## Quick Start

### Requirements
- Node.js 18+
- `ffmpeg` (optional — for video compression)

### Run locally

```bash
git clone https://github.com/nix789/vibeport.git
cd vibeport
npm run install:all
npm run dev
```

Opens:
- Local node API at `http://127.0.0.1:7331`
- Frontend at `http://localhost:5173`

Your identity keypair is generated on first run and saved to `data/identity.json` (never committed, never transmitted).

---

## Run a Relay

Anyone can run a relay. Relays are lightweight — a $4/mo VPS handles hundreds of concurrent connections.

```bash
cd relay
npm install
PORT=4444 npm start
```

Or deploy to a VPS with the included script:

```bash
# from your local machine, using your SSH key
ssh -i ~/.ssh/your_key root@YOUR_VPS_IP 'bash -s' < relay/deploy.sh
```

The deploy script installs pm2, opens the firewall port, and sets up auto-restart on reboot.

### Add a relay to your node

In the Vibeport UI → **Node** tab → paste your relay's WebSocket URL:
```
ws://your-vps-ip:4444
wss://relay.yourdomain.com:4444   ← after TLS setup
```

---

## Project Structure

```
vibeport/
  frontend/          React + Vite + Tailwind UI
    src/
      components/    ProfileView, Feed, Friends, Stickers,
                     Webrings, ThemeEngine, P2PStatus,
                     LandingPage, NodeInit
  node/              Local node (runs on your machine)
    src/
      identity.js    Ed25519 keypair generation
      store.js       SQLite schema
      p2p.js         Hypercore + Hyperswarm
      relay-client.js WebSocket relay client
      media.js       Upload handler, 72h expiry, ffmpeg compression
      api.js         Local HTTP API (localhost only)
      sanitize.js    CSS/HTML sanitizer for profile pages
  relay/             Relay server (deploy to VPS)
    src/
      server.js      WebSocket server + subscription router
      verify.js      Ed25519 signature verification
      db.js          SQLite event cache with eviction
  data/              Your local data — never committed
```

---

## Security

- Profile CSS and HTML render inside a `<iframe sandbox>` — JavaScript is blocked at the browser level
- CSS is sanitized server-side before storage (`sanitize.js`)
- Your secret key never leaves `data/identity.json` (permissions: `0600`)
- Relay verifies every event's Ed25519 signature before storing or forwarding — a compromised relay cannot inject fake events

---

## License

[MIT](LICENSE)

---

## Philosophy

Read [CLAUDE.md](CLAUDE.md) for the full project rules — what will never be built and why.

TOS and Privacy Policy are in `frontend/public/`.
