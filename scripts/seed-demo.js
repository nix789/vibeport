#!/usr/bin/env node
/**
 * seed-demo.js
 * Seeds the admin node's SQLite DB with pseudo-accounts using all available
 * Furry Megamix images, and outputs relay/seeds.json so the relay pre-loads
 * them into its profile cache — making them discoverable in Guest Mode
 * without any node needing to be online.
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
const SEEDS_OUT  = path.resolve(__dirname, '../relay/seeds.json')
const IMG_SRC    = '/media/nix/Shared HDD/Furry Megamix'

if (!fs.existsSync(DB_PATH)) {
  console.error('DB not found. Run the node first: npm run dev')
  process.exit(1)
}
fs.mkdirSync(AVATAR_DIR, { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── Safe incremental migrations ───────────────────────────────────────────────
try { db.exec('ALTER TABLE friends ADD COLUMN interaction_score INTEGER NOT NULL DEFAULT 0') } catch {}
try { db.exec('ALTER TABLE friend_profiles ADD COLUMN avatar TEXT') } catch {}

// ── Images ────────────────────────────────────────────────────────────────────
const allImgs = fs.readdirSync(IMG_SRC)
  .filter(f => /\.(png|jpg|gif)$/i.test(f))
  .sort()

// ── Word lists ────────────────────────────────────────────────────────────────
const ADJECTIVES = [
  'Neon','Glitch','Pixel','Void','Solar','Lunar','Plasma','Cyber','Hyper','Chaos',
  'Echo','Prism','Static','Quantum','Acid','Iron','Rust','Vapor','Retro','Analog',
  'Dark','Bright','Feral','Wild','Free','Raw','Deep','Sharp','Soft','Lost',
  'Found','Drift','Flash','Spark','Storm','Calm','Blaze','Frost','Smoke','Ghost',
  'Chrome','Matte','Gloss','Bare','Bold','Faint','Pure','Toxic','Clean','Broken',
  'Hollow','Sacred','Wired','Offline','Local','Roaming','Signal','Null','Binary','Crisp',
  'Warm','Cold','Dense','Sparse','Lucid','Murky','Vivid','Muted','Loud','Quiet',
]

const ANIMALS = [
  'Fox','Wolf','Raven','Cat','Pup','Dragon','Hound','Ferret','Shark','Bear',
  'Crow','Hyena','Otter','Lizard','Rabbit','Moth','Hawk','Viper','Newt','Weasel',
  'Raccoon','Lynx','Coyote','Jackal','Bat','Deer','Owl','Ram','Elk','Crane',
  'Gecko','Toad','Wasp','Mantis','Kite','Finch','Swift','Mink','Stoat','Pika',
  'Tapir','Capybara','Quokka','Axolotl','Kirin','Tanuki','Kitsune','Gryphon','Basilisk','Wyvern',
  'Pangolin','Numbat','Binturong','Serval','Caracal','Ocelot','Margay','Clouded','Kodkod','Jaguarundi',
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
  'former {adj} {animal} of the attention economy. retired. running my own server now.',
  '{adj} {animal} | artist | coder | refusing to be a product since {year}',
  'somewhere between a {adj} dream and a {animal} nightmare | fully offline-first',
  'your feed is curated. mine is real. {adj} {animal} on a local node.',
  'node uptime: {days} days | {adj} {animal} | no metrics | just people',
  'i deleted the apps. built a port instead. {adj} {animal} vibes only.',
  'if the platform owns the data it owns you | {adj} {animal} | self-hosted life',
  '{adj} {animal} posting into the void. the void cannot sell my data.',
]

const CSS_THEMES = [
  `body{background:#000;color:#00ff41;font-family:monospace}h1{color:#00ff41;text-shadow:0 0 10px #00ff41}p{color:#006622}`,
  `body{background:linear-gradient(135deg,#0a0010,#1a0030);color:#ff00ff}h1{color:#ff00ff;text-shadow:0 0 15px #ff00ff;font-size:2rem}p{color:#cc88ff}`,
  `body{background:#001a2e}h1{color:#00e5ff;text-shadow:0 0 12px #00aaff;font-size:2.2rem}p{color:#006688}`,
  `body{background:#000}h1{color:#ff0066;font-size:2.5rem;font-style:italic}p{color:#660033}`,
  `body{background:linear-gradient(180deg,#1a0500,#2d0800)}h1{color:#ff8c00;text-shadow:0 0 20px #ff4400}p{color:#883300}`,
  `body{background:#f9f9f9;color:#111;font-family:sans-serif}h1{color:#222;font-weight:100;letter-spacing:.3em}p{color:#666}`,
  `body{background:radial-gradient(ellipse,#0a0020,#000)}h1{color:#c0a0ff;text-shadow:0 0 30px #8040ff}p{color:#604090}`,
  `body{background:#0d0800;font-family:monospace}h1{color:#ffb300;text-shadow:0 0 8px #ff8800}p{color:#664400}`,
  `body{background:#050505}h1{color:#00ff41;font-family:monospace;font-size:1.8rem}p{color:#1a3a1a;font-family:monospace}body::before{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,65,.03) 2px,rgba(0,255,65,.03) 4px);pointer-events:none}`,
  `body{background:#fff;color:#111}h1{background:linear-gradient(90deg,red,blue);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:2.5rem}p{color:#444}`,
  `body{background:#0a0a1a}h1{color:#4488ff;font-size:2rem;letter-spacing:.1em}p{color:#223366}`,
  `body{background:#0d0000}h1{color:#cc0000;font-size:2rem;font-family:serif}p{color:#440000}`,
  `body{background:#e8f0ff;color:#112244}h1{color:#0044cc;font-size:2rem}p{color:#445577}`,
  `body{background:#0a1a0a}h1{color:#44cc44;font-family:serif;font-style:italic;font-size:2rem}p{color:#224422}`,
  `body{background:#1a1a1a}h1{color:#ccc;font-size:2rem;font-weight:100;letter-spacing:.4em}p{color:#444}`,
  `body{background:#0a0a0a;color:#e0e0e0;font-family:'Georgia',serif}h1{color:#e0e0e0;font-size:2rem;border-bottom:1px solid #333;padding-bottom:.5rem}p{color:#999;line-height:1.8}`,
  `body{background:linear-gradient(135deg,#000428,#004e92)}h1{color:#7eb8f7;font-size:2rem;text-shadow:0 0 20px #0066cc}p{color:#336699}`,
  `body{background:#2d1b00}h1{color:#d4a017;font-family:'Georgia',serif;font-size:2rem}p{color:#7a5c00}`,
  `body{background:#0a000a}h1{color:#dd00ff;text-shadow:0 0 20px #9900cc;font-size:2.2rem}p{color:#550077}`,
  `body{background:#00001a}h1{color:#0088ff;font-size:2rem;font-family:monospace;text-shadow:0 0 15px #0044ff}p{color:#003388}`,
]

const POSTS = [
  'just set up my node. no algorithm telling me what to see. 👁️',
  'vibes are immaculate today. nobody is tracking me.',
  'reminder that your attention is the product on every other platform. not here.',
  'finally finished my page layout. yes i wrote the CSS myself. yes it took 3 hours.',
  'good morning to everyone on the uncorporate internet ☀️',
  'raised my hand in a vibe last night and actually had a real conversation. wild.',
  'the best thing about p2p is nobody can shadowban you.',
  'working on a new piece. going in a direction i did not plan for.',
  'three cups of coffee and one distributed hash table. productive morning.',
  'just watched a 4 hour documentary about dial-up internet. it was better then.',
  'reminder: your node, your data, your call. forever.',
  'sent my first sticker on here. feels more meaningful than a like button.',
  'joined a webring today. webrings are peak internet culture and i will not be argued out of this.',
  'if your social network can delete your account, you do not own your identity.',
  'decentralized ≠ chaos. it just means nobody else is in charge of your timeline.',
  'my node has been up for 72 hours. zero downtime. zero data sold.',
  'the algorithm was always lying to you about what was popular.',
  'you do not need 1000 followers. you need 10 real ones who actually read.',
  'no notifications. no red badges. just vibes.',
  'logged off every other platform. this is my only port now.',
  'your keys are your identity. nobody can take that.',
  'mesh networking is the future and we are building it one node at a time.',
  'we are building the internet our grandkids will actually want to use.',
  'i post here and nobody is monetizing it. still feels surreal.',
  'end-to-end encryption is not a feature. it is a right.',
  'deleted instagram 6 months ago. genuinely do not miss it.',
  'open source or it did not happen.',
  'local-first software is the most important concept in tech right now and nobody is talking about it.',
  'my data lives on my machine. not in a datacenter i will never see.',
  'the fediverse was right about everything.',
  'ran my first webring and got 12 members in a week. the old internet is alive.',
  'art made for an algorithm is not really art.',
  'posted something at 2am to zero followers and it felt great.',
  'every like button ever made was a trap.',
  'p2p is not a niche thing. it is just the internet before it got bought.',
  'my node survived a power outage. i did not. the node won.',
  'been here 3 weeks. no anxiety. no doom. just connections.',
  'real talk: owning your identity is a superpower.',
  'i have 0 followers and i have never been more at peace.',
  'the internet we want is the internet we build.',
  'currently customizing my CSS at midnight. this is the good timeline.',
  'stickers > likes. fight me.',
  'running a local node teaches you more about networking than any course.',
  'when the platform shuts down you lose everything. when the node is yours you lose nothing.',
  'woke up and my p2p connections were still running. good morning from the protocol.',
  'building my second webring. theme: artists who run their own servers.',
  'tech that puts you in control is not a luxury. it is how it should always have been.',
  'nobody is analyzing my posts for ad targeting. still not over it.',
  'one of us. one of us. one of us. 🌐',
  'found 3 new nodes today through mutual friends. the graph grows.',
]

const MOODS = [
  '💻','🎵','🌙','✨','🔥','🎨','🐾','🌊','⚡','🦾',
  '🌿','🎭','🔮','🎲','🌌','🛸','🎧','🍵','📡','🕹️',
  '🦊','🌸','🏴','🎪','💾','📻','🌃','🧬','⚗️','🔭',
]

// ── Key derivation ────────────────────────────────────────────────────────────
const fakeKey = handle =>
  createHash('sha256').update('vibeport-seed-v3-' + handle).digest('hex')

// ── Generators ────────────────────────────────────────────────────────────────
function makeHandle(i) {
  const adj    = ADJECTIVES[i % ADJECTIVES.length]
  const animal = ANIMALS[Math.floor(i / ADJECTIVES.length) % ANIMALS.length]
  return adj + animal + (i >= ADJECTIVES.length * ANIMALS.length ? String(i) : '')
}

function makeBio(i) {
  const template = BIO_TEMPLATES[i % BIO_TEMPLATES.length]
  const adj      = ADJECTIVES[i % ADJECTIVES.length].toLowerCase()
  const animal   = ANIMALS[Math.floor(i / ADJECTIVES.length) % ANIMALS.length].toLowerCase()
  const year     = 2019 + (i % 6)
  const days     = 14 + (i % 200)
  return template
    .replace('{adj}', adj).replace('{animal}', animal)
    .replace('{year}', year).replace('{days}', days)
}

function makeCSS(i) { return CSS_THEMES[i % CSS_THEMES.length] }

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

const now   = Math.floor(Date.now() / 1000)
const COUNT = allImgs.length   // use all 265 images

console.log(`Seeding ${COUNT} demo accounts…\n`)

const seedsForRelay = []

db.transaction(() => {
  for (let i = 0; i < COUNT; i++) {
    const handle   = makeHandle(i)
    const bio      = makeBio(i)
    const css      = makeCSS(i)
    const img      = allImgs[i]
    const destName = `seed_${i + 1}.png`
    const destPath = path.join(AVATAR_DIR, destName)

    try { fs.copyFileSync(path.join(IMG_SRC, img), destPath) } catch {}

    const address  = fakeKey(handle)
    const addedAt  = now - Math.floor(Math.random() * 60 * 86400)
    const lastSeen = now - Math.floor(Math.random() * 3 * 86400)  // seen within last 3 days
    const score    = Math.floor(Math.random() * 180) + 5

    insertFriend.run({ address, handle, added_at: addedAt, last_seen: lastSeen, interaction_score: score })
    insertProfile.run({ address, handle, bio, avatar: `/avatars/${destName}`, custom_css: css, synced_at: now })

    // 3–6 posts per account
    const postCount = 3 + (i % 4)
    const accountPosts = []
    for (let p = 0; p < postCount; p++) {
      const content   = POSTS[(i * 7 + p * 3) % POSTS.length]
      const mood      = MOODS[(i + p) % MOODS.length]
      const createdAt = now - Math.floor(Math.random() * 30 * 86400)
      insertPost.run({ content, mood, created_at: createdAt })
      accountPosts.push({ content, mood, created_at: createdAt })
    }

    // Collect for relay seeds.json
    seedsForRelay.push({
      nodeKey:    address,
      handle,
      bio,
      custom_css: css,
      avatar:     null,   // avatars served from local node only
      posts:      accountPosts.slice(0, 5),
      updatedAt:  Date.now() - Math.floor(Math.random() * 2 * 86400 * 1000),
    })

    process.stdout.write(`  [${String(i + 1).padStart(3)}/${COUNT}] ${handle.padEnd(25)} ${address.slice(0,14)}…\n`)
  }
})()

// ── Write seeds.json for relay ────────────────────────────────────────────────
fs.writeFileSync(SEEDS_OUT, JSON.stringify(seedsForRelay, null, 2))
console.log(`\nDone. ${COUNT} accounts seeded.`)
console.log(`Relay seeds written to: ${SEEDS_OUT}`)
console.log(`\nDeploy relay seeds to VPS:`)
console.log(`  rsync -avz relay/seeds.json root@147.182.152.76:/opt/vibeport-relay/seeds.json`)
console.log(`  ssh root@147.182.152.76 'systemctl restart vibeport-relay'`)
