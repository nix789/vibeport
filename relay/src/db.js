/**
 * db.js
 * SQLite cache for the relay.
 * Stores the last N events per feed key so late-connecting clients
 * can catch up without the original publisher being online.
 */

import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR   = path.resolve(__dirname, '../data')
const DB_PATH    = path.join(DATA_DIR, 'relay.db')
const MAX_EVENTS = 500   // max cached events per feed
const MAX_FEEDS  = 10000 // evict oldest feeds beyond this

let db

export function openDB() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_key    TEXT    NOT NULL,           -- publisher's 64-char hex pubkey
      seq         INTEGER NOT NULL,           -- Hypercore sequence number
      payload     BLOB    NOT NULL,           -- raw signed event bytes
      received_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE (feed_key, seq)
    );

    CREATE INDEX IF NOT EXISTS idx_events_feed ON events (feed_key, seq);

    CREATE TABLE IF NOT EXISTS feeds (
      feed_key     TEXT    PRIMARY KEY,
      last_seq     INTEGER NOT NULL DEFAULT 0,
      first_seen   INTEGER NOT NULL DEFAULT (unixepoch()),
      last_active  INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  return db
}

export function getDB() {
  if (!db) throw new Error('DB not initialized')
  return db
}

/** Persist a signed event, evicting old ones if needed */
export function storeEvent(feedKey, seq, payload) {
  const db = getDB()

  db.prepare(`
    INSERT OR IGNORE INTO events (feed_key, seq, payload)
    VALUES (?, ?, ?)
  `).run(feedKey, seq, payload)

  db.prepare(`
    INSERT INTO feeds (feed_key, last_seq, last_active)
    VALUES (?, ?, unixepoch())
    ON CONFLICT(feed_key) DO UPDATE SET
      last_seq    = MAX(last_seq, excluded.last_seq),
      last_active = excluded.last_active
  `).run(feedKey, seq)

  // Evict oldest events beyond MAX_EVENTS for this feed
  db.prepare(`
    DELETE FROM events WHERE feed_key = ? AND id NOT IN (
      SELECT id FROM events WHERE feed_key = ?
      ORDER BY seq DESC LIMIT ${MAX_EVENTS}
    )
  `).run(feedKey, feedKey)
}

/** Return cached events for a feed starting from a sequence number */
export function getEvents(feedKey, fromSeq = 0) {
  return getDB().prepare(`
    SELECT seq, payload FROM events
    WHERE feed_key = ? AND seq >= ?
    ORDER BY seq ASC
    LIMIT ${MAX_EVENTS}
  `).all(feedKey, fromSeq)
}

/** Return the highest seq the relay has for a feed */
export function getHead(feedKey) {
  const row = getDB().prepare(`
    SELECT last_seq FROM feeds WHERE feed_key = ?
  `).get(feedKey)
  return row?.last_seq ?? -1
}

/** Periodic eviction of oldest feeds when total exceeds MAX_FEEDS */
export function evictOldFeeds() {
  const db = getDB()
  const count = db.prepare('SELECT COUNT(*) as n FROM feeds').get().n
  if (count <= MAX_FEEDS) return

  const excess = count - MAX_FEEDS
  const oldest = db.prepare(`
    SELECT feed_key FROM feeds ORDER BY last_active ASC LIMIT ?
  `).all(excess).map(r => r.feed_key)

  for (const key of oldest) {
    db.prepare('DELETE FROM events WHERE feed_key = ?').run(key)
    db.prepare('DELETE FROM feeds WHERE feed_key = ?').run(key)
  }
  console.log(`[db] Evicted ${oldest.length} inactive feeds`)
}
