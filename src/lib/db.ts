import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

export function openDb() {
  mkdirSync("data", { recursive: true });
  const db = new Database("data/openrabbit.sqlite");
  sqliteVec.load(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS commits (
      owner TEXT NOT NULL,
      repo TEXT NOT NULL,
      sha TEXT NOT NULL,
      PRIMARY KEY (owner, repo, sha)
    );
    CREATE TABLE IF NOT EXISTS files (
      owner TEXT NOT NULL,
      repo TEXT NOT NULL,
      sha TEXT NOT NULL,
      path TEXT NOT NULL,
      PRIMARY KEY (owner, repo, sha, path)
    );
    CREATE TABLE IF NOT EXISTS chunks (
      owner TEXT NOT NULL,
      repo TEXT NOT NULL,
      sha TEXT NOT NULL,
      path TEXT NOT NULL,
      symbol TEXT NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      text TEXT NOT NULL,
      id INTEGER PRIMARY KEY,
      UNIQUE (owner, repo, sha, path, symbol, start_line, end_line)
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS chunk_vectors USING vec0(
      embedding float[1536]
    );
  `);
  return db;
}
