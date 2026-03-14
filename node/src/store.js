/**
 * store.js
 * SQLite database for local profile, posts, friends, and stickers.
 * All data stays on-device. Sync happens via Hypercore replication.
 */

import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '../../data')
const DB_PATH = path.join(DATA_DIR, 'vibeport.db')

let db

export function openDB() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

export function getDB() {
  if (!db) throw new Error('DB not initialized. Call openDB() first.')
  return db
}

function migrate(db) {
  db.exec(`
    -- My own profile
    CREATE TABLE IF NOT EXISTS profile (
      id          INTEGER PRIMARY KEY CHECK (id = 1),
      handle      TEXT    NOT NULL DEFAULT 'anon',
      bio         TEXT    NOT NULL DEFAULT '',
      song_url    TEXT    NOT NULL DEFAULT '',
      custom_css  TEXT    NOT NULL DEFAULT '',
      custom_html TEXT    NOT NULL DEFAULT '',
      avatar      TEXT    NOT NULL DEFAULT '',
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    INSERT OR IGNORE INTO profile (id) VALUES (1);

    -- Posts (append-only log, like a blog/bulletin)
    CREATE TABLE IF NOT EXISTS posts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      content    TEXT    NOT NULL DEFAULT '',
      mood       TEXT    NOT NULL DEFAULT '',
      media      TEXT,                          -- relative path to media file, NULL if text-only
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Media files with 72h expiry (managed by media.js)
    CREATE TABLE IF NOT EXISTS media_files (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      filename   TEXT    NOT NULL UNIQUE,
      mime_type  TEXT    NOT NULL,
      size_bytes INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Friends (by their public key address)
    CREATE TABLE IF NOT EXISTS friends (
      address           TEXT    PRIMARY KEY,
      handle            TEXT    NOT NULL DEFAULT '',
      added_at          INTEGER NOT NULL DEFAULT (unixepoch()),
      last_seen         INTEGER,
      interaction_score INTEGER NOT NULL DEFAULT 0
    );

    -- Cached friend profiles synced from P2P
    CREATE TABLE IF NOT EXISTS friend_profiles (
      address     TEXT    PRIMARY KEY,
      handle      TEXT,
      bio         TEXT,
      avatar      TEXT,
      song_url    TEXT,
      custom_css  TEXT,
      custom_html TEXT,
      synced_at   INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (address) REFERENCES friends(address)
    );

    -- Stickers sent/received (intentional interactions, not vanity)
    CREATE TABLE IF NOT EXISTS stickers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      direction   TEXT    NOT NULL CHECK (direction IN ('sent', 'received')),
      peer        TEXT    NOT NULL,
      sticker_id  TEXT    NOT NULL,
      message     TEXT    NOT NULL DEFAULT '',
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Webrings this node belongs to
    CREATE TABLE IF NOT EXISTS webrings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      topic_key  TEXT    NOT NULL UNIQUE,
      joined_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Relay servers this node connects to
    CREATE TABLE IF NOT EXISTS relays (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      url        TEXT    NOT NULL UNIQUE,
      enabled    INTEGER NOT NULL DEFAULT 1,
      added_at   INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  // Incremental migrations (safe to run repeatedly)
  try { db.exec(`ALTER TABLE friend_profiles ADD COLUMN avatar TEXT`) } catch {}
}
