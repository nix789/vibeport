#!/usr/bin/env node
/**
 * seed-demo.js
 * Populates the admin node's SQLite DB with 20 pseudo-accounts
 * so new users see an active network when they first join.
 *
 * Run: node scripts/seed-demo.js
 *
 * Images come from: /media/nix/Shared HDD/Furry Megamix/
 * They are copied to data/avatars/ as seed_N.png
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR  = path.resolve(__dirname, '../data')
const DB_PATH   = path.join(DATA_DIR, 'vibeport.db')
const AVATAR_DIR = path.join(DATA_DIR, 'avatars')
const IMG_SRC   = '/media/nix/Shared HDD/Furry Megamix'

if (!fs.existsSync(DB_PATH)) {
  console.error('DB not found. Run the node first: npm run dev')
  process.exit(1)
}

fs.mkdirSync(AVATAR_DIR, { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── Pick 20 images ────────────────────────────────────────────────────────────
const allImgs = fs.readdirSync(IMG_SRC)
  .filter(f => /\.(png|jpg|gif)$/i.test(f))
  .slice(0, 20)

// ── Fake profiles ─────────────────────────────────────────────────────────────
const ACCOUNTS = [
  {
    handle: 'FoxGlitch',
    bio: 'digital fox wandering the peer-to-peer forests 🦊 | glitch art | no ads ever',
    css: `body { background: linear-gradient(135deg, #0a0010, #1a0030); }
h1 { color: #ff00ff; text-shadow: 0 0 10px #ff00ff; font-size: 2rem; }
p  { color: #cc88ff; }`,
  },
  {
    handle: 'NeonWolf',
    bio: 'howling at the decentralized moon 🐺 | synthwave | hypercore forever',
    css: `body { background: #000; color: #00ffff; }
h1 { font-size: 2.5rem; text-shadow: 0 0 20px #00ffff, 0 0 40px #0088ff; }
p  { color: #0088cc; font-family: 'Courier New', monospace; }`,
  },
  {
    handle: 'PixelPup',
    bio: '8-bit soul in a 4K world 🐕 | retro gaming | making art nobody asked for',
    css: `body { background: #1a1a2e; image-rendering: pixelated; }
h1 { color: #ffd700; font-family: monospace; font-size: 1.8rem; letter-spacing: .2em; }
p  { color: #aaaaaa; font-family: monospace; }`,
  },
  {
    handle: 'CryptoKat',
    bio: 'your keys your coins your vibes 😸 | p2p only | no landlord platforms',
    css: `body { background: #0f0f0f; }
h1 { background: linear-gradient(90deg, #ff6b6b, #ffd93d, #6bff6b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
p  { color: #888; }`,
  },
  {
    handle: 'StarDragon',
    bio: 'cosmic dragon vibing in the ether ✨🐉 | art | music | eternal chaos',
    css: `body { background: radial-gradient(ellipse at center, #0a0020 0%, #000 70%); }
h1 { color: #c0a0ff; font-size: 2.2rem; text-shadow: 0 0 30px #8040ff; }
p  { color: #9060cc; }`,
  },
  {
    handle: 'GlitchFerret',
    bio: 'corrupted files and good vibes only 🦡 | glitch | noise music | escaping the algorithm',
    css: `body { background: #000; }
h1 { color: #00ff41; font-family: monospace; animation: none; }
p  { color: #006622; font-family: monospace; font-size: .85rem; }
body::before { content: ''; position: fixed; inset: 0; background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,.03) 2px, rgba(0,255,65,.03) 4px); pointer-events: none; }`,
  },
  {
    handle: 'VoidRaven',
    bio: 'darkness as aesthetic 🖤🐦 | dark ambient | lore | decentralized everything',
    css: `body { background: #050505; color: #3a3a3a; }
h1 { color: #ffffff; font-size: 2rem; letter-spacing: .3em; font-weight: 100; }
p  { color: #444; letter-spacing: .05em; }`,
  },
  {
    handle: 'SolarFox',
    bio: 'chasing sunsets and open protocols ☀️🦊 | lofi | photography | free software',
    css: `body { background: linear-gradient(180deg, #1a0500 0%, #2d0800 100%); }
h1 { color: #ff8c00; text-shadow: 0 0 20px #ff4400; }
p  { color: #cc6600; }`,
  },
  {
    handle: 'ByteHound',
    bio: 'sniffing packets and chasing bugs 🐕‍🦺 | backend | distributed systems | coffee',
    css: `body { background: #0d1117; font-family: 'Courier New', monospace; }
h1 { color: #58a6ff; font-size: 1.6rem; }
p  { color: #8b949e; }
h1::before { content: '> '; color: #58a6ff; }`,
  },
  {
    handle: 'PrismCat',
    bio: 'refracting light through every prism 🌈😺 | art | color theory | no algorithm needed',
    css: `body { background: #fff; color: #111; }
h1 { background: linear-gradient(90deg, red, orange, yellow, green, blue, violet); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 2rem; }
p  { color: #555; }`,
  },
  {
    handle: 'NightCrow',
    bio: 'up at 3am making things nobody asked for 🐦‍⬛ | dark synth | poetry | p2p vibes',
    css: `body { background: #05050a; }
h1 { color: #4040ff; font-size: 2rem; text-shadow: 0 0 15px #2020aa; }
p  { color: #202060; }`,
  },
  {
    handle: 'PlasmaShark',
    bio: 'electric dreams in a coral reef 🦈⚡ | techno | motion graphics | fed-up with big tech',
    css: `body { background: #001a2e; }
h1 { color: #00e5ff; text-shadow: 0 0 10px #00aaff; font-size: 2rem; }
p  { color: #00668a; }`,
  },
  {
    handle: 'ChaosRabbit',
    bio: 'entropy is a feature not a bug 🐰💫 | noise | experimental | truly free',
    css: `body { background: #ff0099; color: #ffff00; }
h1 { font-size: 3rem; transform: rotate(-2deg); display: inline-block; }
p  { font-size: 1.1rem; font-style: italic; }`,
  },
  {
    handle: 'IronFox',
    bio: 'building things that last longer than VC funding 🦊🔩 | systems | rust | no BS',
    css: `body { background: #1c1c1c; color: #d4d4d4; font-family: sans-serif; }
h1 { color: #e87040; font-size: 1.8rem; font-weight: 700; }
p  { color: #888; line-height: 1.8; }`,
  },
  {
    handle: 'LunarHyena',
    bio: 'laughing at the moon and the centralized web 🌕🦴 | weird art | dadaism | free range vibes',
    css: `body { background: #f5f0e8; color: #222; font-family: Georgia, serif; }
h1 { color: #8b0000; font-size: 2.5rem; font-style: italic; }
p  { color: #555; }`,
  },
  {
    handle: 'StaticKitty',
    bio: 'TV snow and dial-up dreams 😸📺 | vaporwave | retrowave | your data is NOT a product',
    css: `body { background: #e0d0ff; }
h1 { color: #9000ff; font-family: 'Arial Black', sans-serif; font-size: 2rem; text-shadow: 3px 3px #ff00aa; }
p  { color: #6600cc; }`,
  },
  {
    handle: 'QuasarBear',
    bio: 'collapsing stars and expanding playlists 🐻🌌 | ambient | space | offline first',
    css: `body { background: radial-gradient(ellipse at 20% 50%, #060020 0%, #000 60%); }
h1 { color: #fff; font-size: 2rem; font-weight: 100; letter-spacing: .4em; text-transform: uppercase; }
p  { color: #444; letter-spacing: .1em; }`,
  },
  {
    handle: 'AcidDolphin',
    bio: 'squeaking in frequencies humans cannot hear 🐬🎵 | jungle | acid | no tracking ever',
    css: `body { background: #00ff99; color: #003322; }
h1 { font-size: 2.5rem; color: #001a11; text-shadow: 2px 2px #00cc77; }
p  { color: #004433; }`,
  },
  {
    handle: 'RustWeasel',
    bio: 'oxidized and memory-safe 🦦 | systems programming | low latency | old internet values',
    css: `body { background: #2d1a0e; color: #d4a870; font-family: monospace; }
h1 { color: #e87040; font-size: 1.8rem; }
p  { color: #996633; }`,
  },
  {
    handle: 'MirrorWolf',
    bio: 'reflecting the world back at itself 🐺🪞 | philosophy | music | building the exit ramp',
    css: `body { background: #111; }
h1 { color: #fff; font-size: 2rem; font-weight: 100; letter-spacing: .2em; }
p  { color: #666; font-style: italic; }`,
  },
]

const POSTS = [
  "just set up my node. no algorithm telling me what to see. this is what the internet should feel like",
  "vibes are immaculate today. listening to synthwave and not being tracked.",
  "reminder that your attention is the product on every other platform. not here.",
  "finally finished my page layout. yes i wrote the CSS myself. no i will not be accepting feedback.",
  "good morning to everyone on the uncorporate internet",
  "raised my hand in a vibe last night and actually had a conversation. wild concept.",
  "the best thing about p2p is nobody can shadowban you. your reach is 100%. period.",
  "working on a new piece. it's going in a direction i did not plan. that's usually how the good ones go.",
  "three cups of coffee and one distributed hash table. productive morning.",
  "just watched a 4 hour documentary about dial-up internet. it was better then.",
  "reminder: your node, your data, your call.",
  "sent my first sticker on here. feels more meaningful than a like. odd but good.",
  "joined a webring today. webrings are peak internet culture and i will not be taking questions.",
]

// ── Deterministic fake key from handle ───────────────────────────────────────
function fakeKey(handle) {
  return createHash('sha256').update('vibeport-seed-' + handle).digest('hex')
}

// ── Insert ────────────────────────────────────────────────────────────────────
const insertFriend = db.prepare(`
  INSERT OR IGNORE INTO friends (address, handle, added_at, last_seen, interaction_score)
  VALUES (@address, @handle, @added_at, @last_seen, @interaction_score)
`)

const insertProfile = db.prepare(`
  INSERT OR REPLACE INTO friend_profiles (address, handle, bio, avatar, custom_css, synced_at)
  VALUES (@address, @handle, @bio, @avatar, @custom_css, @synced_at)
`)

const insertPost = db.prepare(`
  INSERT INTO posts (content, mood, created_at) VALUES (@content, @mood, @created_at)
`)

const MOODS = ['💻', '🎵', '🌙', '✨', '🔥', '🎨', '🐾', '🌊']

console.log('Seeding demo accounts…\n')

const now = Math.floor(Date.now() / 1000)

db.transaction(() => {
  ACCOUNTS.forEach((acc, i) => {
    const img      = allImgs[i] ?? allImgs[0]
    const srcPath  = path.join(IMG_SRC, img)
    const destName = `seed_${i + 1}.png`
    const destPath = path.join(AVATAR_DIR, destName)

    // Copy avatar image
    try {
      fs.copyFileSync(srcPath, destPath)
    } catch (e) {
      console.warn(`  Could not copy ${img}: ${e.message}`)
    }

    const address = fakeKey(acc.handle)
    const avatarUrl = `/avatars/${destName}`
    const addedAt = now - Math.floor(Math.random() * 60 * 86400) // up to 60 days ago
    const lastSeen = addedAt + Math.floor(Math.random() * 7 * 86400)
    const score = Math.floor(Math.random() * 80) + 5

    insertFriend.run({ address, handle: acc.handle, added_at: addedAt, last_seen: lastSeen, interaction_score: score })
    insertProfile.run({ address, handle: acc.handle, bio: acc.bio, avatar: avatarUrl, custom_css: acc.css, synced_at: now })

    // Give each account 2-4 posts
    const postCount = 2 + (i % 3)
    for (let p = 0; p < postCount; p++) {
      const content = POSTS[(i + p) % POSTS.length]
      const mood    = MOODS[(i + p) % MOODS.length]
      const createdAt = addedAt + Math.floor(Math.random() * 30 * 86400)
      insertPost.run({ content, mood, created_at: createdAt })
    }

    console.log(`  [${i + 1}/20] ${acc.handle}  →  ${address.slice(0, 16)}…  avatar: ${destName}`)
  })
})()

console.log('\nDone. Restart the node to see seed profiles in Discover.')
