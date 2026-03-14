#!/usr/bin/env node
/**
 * seed-demo.js
 * Seeds the admin node's SQLite DB with 100 pseudo-accounts
 * so new users see a populated network on first launch.
 *
 * Run from node/ directory:
 *   node --input-type=module < ../scripts/seed-demo.js
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR   = path.resolve(__dirname, '../data')
const DB_PATH    = path.join(DATA_DIR, 'vibeport.db')
const AVATAR_DIR = path.join(DATA_DIR, 'avatars')
const IMG_SRC    = '/media/nix/Shared HDD/Furry Megamix'

if (!fs.existsSync(DB_PATH)) {
  console.error('DB not found. Run the node first: npm run dev')
  process.exit(1)
}
fs.mkdirSync(AVATAR_DIR, { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── Images ────────────────────────────────────────────────────────────────────
const allImgs = fs.readdirSync(IMG_SRC)
  .filter(f => /\.(png|jpg|gif)$/i.test(f))

// ── Handle + bio + CSS generator ─────────────────────────────────────────────
const ADJECTIVES = [
  'Neon','Glitch','Pixel','Void','Solar','Lunar','Plasma','Cyber','Hyper','Chaos',
  'Echo','Prism','Static','Quantum','Acid','Iron','Rust','Vapor','Retro','Analog',
  'Dark','Bright','Feral','Wild','Free','Raw','Deep','Sharp','Soft','Lost',
  'Found','Drift','Flash','Spark','Storm','Calm','Blaze','Frost','Smoke','Ghost',
  'Chrome','Matte','Gloss','Bare','Bold','Faint','Pure','Toxic','Clean','Broken',
]

const ANIMALS = [
  'Fox','Wolf','Raven','Cat','Pup','Dragon','Hound','Ferret','Shark','Bear',
  'Crow','Hyena','Otter','Lizard','Rabbit','Moth','Hawk','Viper','Newt','Weasel',
  'Raccoon','Lynx','Coyote','Jackal','Bat','Deer','Owl','Ram','Elk','Crane',
  'Gecko','Toad','Wasp','Mantis','Kite','Finch','Swift','Mink','Stoat','Pika',
  'Tapir','Capybara','Quokka','Axolotl','Kirin','Tanuki','Kitsune','Gryphon','Basilisk','Wyvern',
]

const BIO_TEMPLATES = [
  'just a {adj} {animal} vibing in the decentralized wild 🌐 | no algorithm | no landlords',
  '{adj} {animal} building things nobody asked for | p2p forever | your data is yours',
  'escaped the cloud. running on my own node now 🦾 | {adj} energy | {animal} hours',
  'found the exit ramp from big tech. landing zone: vibeport | {adj} | {animal} coded',
  '{animal} who programs | {adj} aesthetics | lofi + open protocols + no tracking',
  'digital {animal} wandering the peer-to-peer forests 🌲 | {adj} mode always on',
  'the {adj} {animal} at the end of the algorithm | making art for nobody',
  'i am a {animal} and i support a free and open internet | {adj} by design',
  '{adj} {animal} | I do not consent to data harvesting | this node is mine',
  'on vibeport because big tech got boring | {animal} | {adj} | decentralized always',
]

const CSS_THEMES = [
  // dark green terminal
  `body{background:#000;color:#00ff41;font-family:monospace}h1{color:#00ff41;text-shadow:0 0 10px #00ff41}p{color:#006622}`,
  // vaporwave
  `body{background:linear-gradient(135deg,#0a0010,#1a0030);color:#ff00ff}h1{color:#ff00ff;text-shadow:0 0 15px #ff00ff;font-size:2rem}p{color:#cc88ff}`,
  // neon cyan
  `body{background:#001a2e}h1{color:#00e5ff;text-shadow:0 0 12px #00aaff;font-size:2.2rem}p{color:#006688}`,
  // hot pink
  `body{background:#000}h1{color:#ff0066;font-size:2.5rem;font-style:italic}p{color:#660033}`,
  // orange sunset
  `body{background:linear-gradient(180deg,#1a0500,#2d0800)}h1{color:#ff8c00;text-shadow:0 0 20px #ff4400}p{color:#883300}`,
  // white minimal
  `body{background:#f9f9f9;color:#111;font-family:sans-serif}h1{color:#222;font-weight:100;letter-spacing:.3em}p{color:#666}`,
  // dark purple
  `body{background:radial-gradient(ellipse,#0a0020,#000)}h1{color:#c0a0ff;text-shadow:0 0 30px #8040ff}p{color:#604090}`,
  // amber terminal
  `body{background:#0d0800;font-family:monospace}h1{color:#ffb300;text-shadow:0 0 8px #ff8800}p{color:#664400}`,
  // green scanlines
  `body{background:#050505}h1{color:#00ff41;font-family:monospace;font-size:1.8rem}p{color:#1a3a1a;font-family:monospace}body::before{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,65,.03) 2px,rgba(0,255,65,.03) 4px);pointer-events:none}`,
  // bold primary
  `body{background:#fff;color:#111}h1{background:linear-gradient(90deg,red,blue);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:2.5rem}p{color:#444}`,
  // dark blue
  `body{background:#0a0a1a}h1{color:#4488ff;font-size:2rem;letter-spacing:.1em}p{color:#223366}`,
  // blood red
  `body{background:#0d0000}h1{color:#cc0000;font-size:2rem;font-family:serif}p{color:#440000}`,
  // ice white
  `body{background:#e8f0ff;color:#112244}h1{color:#0044cc;font-size:2rem}p{color:#445577}`,
  // forest
  `body{background:#0a1a0a}h1{color:#44cc44;font-family:serif;font-style:italic;font-size:2rem}p{color:#224422}`,
  // chrome
  `body{background:#1a1a1a}h1{color:#ccc;font-size:2rem;font-weight:100;letter-spacing:.4em}p{color:#444}`,
]

const POSTS = [
  'just set up my node. no algorithm telling me what to see.',
  'vibes are immaculate today. nobody is tracking me.',
  'reminder that your attention is the product on every other platform. not here.',
  'finally finished my page layout. yes i wrote the CSS myself.',
  'good morning to everyone on the uncorporate internet',
  'raised my hand in a vibe last night and actually had a conversation.',
  'the best thing about p2p is nobody can shadowban you.',
  'working on a new piece. going in a direction i did not plan.',
  'three cups of coffee and one distributed hash table.',
  'just watched a 4 hour documentary about dial-up internet. it was better then.',
  'reminder: your node, your data, your call.',
  'sent my first sticker on here. feels more meaningful than a like.',
  'joined a webring today. webrings are peak internet culture.',
  'if your social network can delete your account, you do not own your identity.',
  'decentralized ≠ chaos. it just means nobody else is in charge.',
  'my node has been up for 72 hours. zero downtime. zero data sold.',
  'the algorithm was always lying to you about what was popular.',
  'you do not need 1000 followers. you need 10 real ones.',
  'no notifications. no red badges. just vibes.',
  'logged off every other platform. this is my only port now.',
  'crypto is not just money. it is keys. your keys. your identity.',
  'mesh networking is the future and bluetooth p2p is just the beginning.',
  'we are building the internet our grandkids will actually want to use.',
  'i post here and nobody is monetizing it. wild concept.',
  'end-to-end encryption is not a feature. it is a right.',
]

const MOODS = ['💻','🎵','🌙','✨','🔥','🎨','🐾','🌊','⚡','🦾','🌿','🎭','🔮','🎲','🌌']

// ── Key derivation ────────────────────────────────────────────────────────────
const fakeKey = handle =>
  createHash('sha256').update('vibeport-seed-v2-' + handle).digest('hex')

// ── Generate 100 handles ──────────────────────────────────────────────────────
function makeHandle(i) {
  const adj    = ADJECTIVES[i % ADJECTIVES.length]
  const animal = ANIMALS[Math.floor(i / ADJECTIVES.length) % ANIMALS.length]
  return adj + animal + (i >= ADJECTIVES.length * ANIMALS.length ? String(i) : '')
}

function makeBio(handle, i) {
  const template = BIO_TEMPLATES[i % BIO_TEMPLATES.length]
  const adj      = ADJECTIVES[i % ADJECTIVES.length].toLowerCase()
  const animal   = ANIMALS[Math.floor(i / ADJECTIVES.length) % ANIMALS.length].toLowerCase()
  return template.replace('{adj}', adj).replace('{animal}', animal)
}

function makeCSS(i) {
  return CSS_THEMES[i % CSS_THEMES.length]
}

// ── DB statements ─────────────────────────────────────────────────────────────
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

const now = Math.floor(Date.now() / 1000)
const COUNT = Math.min(100, allImgs.length)

console.log(`Seeding ${COUNT} demo accounts…\n`)

db.transaction(() => {
  for (let i = 0; i < COUNT; i++) {
    const handle   = makeHandle(i)
    const bio      = makeBio(handle, i)
    const css      = makeCSS(i)
    const img      = allImgs[i]
    const destName = `seed_${i + 1}.png`
    const destPath = path.join(AVATAR_DIR, destName)

    try { fs.copyFileSync(path.join(IMG_SRC, img), destPath) } catch {}

    const address  = fakeKey(handle)
    const addedAt  = now - Math.floor(Math.random() * 90 * 86400)
    const lastSeen = addedAt + Math.floor(Math.random() * 14 * 86400)
    const score    = Math.floor(Math.random() * 120) + 2

    insertFriend.run({ address, handle, added_at: addedAt, last_seen: lastSeen, interaction_score: score })
    insertProfile.run({ address, handle, bio, avatar: `/avatars/${destName}`, custom_css: css, synced_at: now })

    // 2–4 posts per account
    const postCount = 2 + (i % 3)
    for (let p = 0; p < postCount; p++) {
      const content   = POSTS[(i * 3 + p) % POSTS.length]
      const mood      = MOODS[(i + p) % MOODS.length]
      const createdAt = addedAt + Math.floor(Math.random() * 45 * 86400)
      insertPost.run({ content, mood, created_at: createdAt })
    }

    process.stdout.write(`  [${String(i + 1).padStart(3)}/${COUNT}] ${handle.padEnd(22)} ${address.slice(0,14)}…\n`)
  }
})()

console.log(`\nDone. ${COUNT} accounts seeded with avatars, bios, CSS, and posts.`)
