import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { Parser } from "tar";
import { openDb } from "@/lib/db";
import { githubHeaders } from "@/lib/github";
import { chunkSource, type Chunk } from "@/lib/treesitter";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist"]);
const SKIP_FILES = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);

async function embedTexts(texts: string[]) {
  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: texts,
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  const { data } = (await response.json()) as {
    data: { index: number; embedding: number[] }[];
  };
  return data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
}

type IndexedFile = { path: string; chunks: Chunk[] };

function shouldIndex(path: string) {
  const parts = path.split("/");
  if (parts.some((part) => SKIP_DIRS.has(part))) return false;
  return !SKIP_FILES.has(parts.at(-1)!);
}

function stripArchiveRoot(entryPath: string) {
  const slash = entryPath.indexOf("/");
  if (slash === -1) return null;
  return entryPath.slice(slash + 1);
}

function sourceFiles(archive: Buffer) {
  const pending: Promise<IndexedFile>[] = [];
  return new Promise<IndexedFile[]>((resolve, reject) => {
    const parser = new Parser();
    parser.on("entry", (entry) => {
      const path = stripArchiveRoot(entry.path);
      if (!path || entry.type !== "File" || !shouldIndex(path)) {
        entry.resume();
        return;
      }
      const parts: Buffer[] = [];
      entry.on("data", (part: Buffer) => parts.push(part));
      entry.on("end", () => {
        const text = Buffer.concat(parts).toString("utf8");
        pending.push(chunkSource(path, text).then((chunks) => ({ path, chunks })));
      });
    });
    parser.on("end", () => resolve(Promise.all(pending)));
    parser.on("error", reject);
    const gunzip = createGunzip();
    gunzip.on("error", reject);
    Readable.from(archive).pipe(gunzip).pipe(parser);
  });
}

export async function indexBaseCommit(token: string, owner: string, repo: string, sha: string) {
  const db = openDb();
  const indexed = db
    .prepare(`SELECT 1 FROM commits WHERE owner = ? AND repo = ? AND sha = ?`)
    .get(owner, repo, sha);
  if (indexed) return;

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/tarball/${sha}`, {
    headers: githubHeaders(token),
  });
  if (!response.ok || !response.body) throw new Error(await response.text());

  const files = await sourceFiles(Buffer.from(await response.arrayBuffer()));

  const insertFile = db.prepare(
    `INSERT INTO files (owner, repo, sha, path) VALUES (?, ?, ?, ?)`,
  );
  const insertChunk = db.prepare(
    `INSERT INTO chunks (owner, repo, sha, path, symbol, start_line, end_line, text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertChunkVector = db.prepare(
    `INSERT INTO chunk_vectors (rowid, embedding) VALUES (?, ?)`,
  );

  const chunks = files.flatMap((file) => file.chunks.map((chunk) => ({
    path: file.path,
    chunk
  })));

  const embeddedTexts = await embedTexts(chunks.map(({ path, chunk }) => `${path}\n${chunk.symbol}\n${chunk.text}`));
  
  let embeddingIndex = 0;
  const save = db.transaction(() => {
    for (const file of files) {
      insertFile.run(owner, repo, sha, file.path);
      for (const chunk of file.chunks) {
        const { lastInsertRowid } = insertChunk.run(
          owner,
          repo,
          sha,
          file.path,
          chunk.symbol,
          chunk.startLine,
          chunk.endLine,
          chunk.text,
        );
        insertChunkVector.run(
          BigInt(lastInsertRowid),
          new Float32Array(embeddedTexts[embeddingIndex]),
        );
        embeddingIndex++;
      }
    }
    db.prepare(`INSERT INTO commits (owner, repo, sha) VALUES (?, ?, ?)`).run(owner, repo, sha);
  });
  save();
  console.log(`indexed ${files.length} files at ${sha}`);
}
