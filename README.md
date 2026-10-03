# OpenRabbit

OpenRabbit is a self-hosted GitHub App that reviews pull requests. When a pull request is opened, updated, or reopened, it reads the diff, searches the base commit for related code, and posts a review comment.

It comments when a change can introduce a bug, a security issue, duplicated logic, work outside the pull request's goal, a problem at real load, or a break with a pattern already in the repository. A small, safe fix is posted as a GitHub suggestion block. A pull request with nothing in that list gets a short note and stops there.

## How a review runs

1. GitHub delivers a `pull_request` webhook to `POST /api/github/webhook`.
2. OpenRabbit checks the `X-Hub-Signature-256` header against `GITHUB_WEBHOOK_SECRET` and responds `200` immediately.
3. In the same process, it fetches the pull request diff and downloads the base commit as a tarball.
4. Tree-sitter splits supported source files into symbols. Each symbol is embedded with OpenRouter and stored in `data/openrabbit.sqlite` using [sqlite-vec](https://github.com/asg017/sqlite-vec).
5. `openai/gpt-4o-mini` on [OpenRouter](https://openrouter.ai) reads the title, description, and diff. It can call `searchCode`, which returns the nearest symbols from that base commit.
6. The finished Markdown is posted on the pull request as a comment review. It does not approve or request changes.

A base commit is indexed once. Later reviews of the same SHA reuse the stored chunks.

The review keeps running after the webhook response, and the index is a file on disk. Run OpenRabbit as a long-lived Node process with a persistent disk. A serverless host that freezes after the response will drop the review.

## Languages

Tree-sitter indexes `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.py`, `.go`, `.rs`, `.java`, `.c`, `.h`, `.cc`, `.cpp`, `.cxx`, `.hpp`, `.hh`, `.cs`, `.rb`, `.php`, `.kt`, `.kts`, `.swift`, `.scala`, `.sc`, `.dart`, `.ex`, `.exs`, `.lua`, `.zig`, `.groovy`, `.gradle`, `.sh`, `.bash`, `.ps1`, `.sql`, `.html`, `.htm`, `.css`, `.scss`, `.sass`, `.less`, `.vue`, `.svelte`, `.graphql`, `.gql`, and `.proto`. JSON, YAML, TOML, and HCL (`.json`, `.yml`, `.yaml`, `.toml`, `.hcl`, `.tf`) are indexed by key or block. Vue and Svelte script and style blocks are indexed with the language named in their `lang` attribute. A supported file whose grammar finds no symbols is stored as one chunk. Other files are left out. Paths inside `node_modules`, `.git`, and `dist` are left out, along with `package-lock.json`, `pnpm-lock.yaml`, and `yarn.lock`.

## Requirements

- Node.js 20.9 or newer
- pnpm 11.1.1
- A C compiler toolchain (`better-sqlite3` and `sqlite-vec` are native modules)
- A GitHub App installed on the repositories you want reviewed
- An OpenRouter API key with access to `openai/text-embedding-3-small` and `openai/gpt-4o-mini`
- A public HTTPS URL that GitHub can reach

Full setup, from creating the GitHub App through a production process, is in [SETUP.md](SETUP.md).

## Configuration

Create a `.env` file in the project root. Next.js loads it when the server starts. Paths are resolved from the directory you start the process in, which should be the project root.

| Variable | Purpose |
| --- | --- |
| `GITHUB_APP_ID` | Numeric App ID from the GitHub App settings page |
| `GITHUB_PRIVATE_KEY_PATH` | Path to the App private key (`.pem`), absolute or relative to the project root |
| `GITHUB_WEBHOOK_SECRET` | Same secret configured on the GitHub App webhook |
| `OPENROUTER_API_KEY` | Key used for embeddings and the review model |

Embeddings use `openai/text-embedding-3-small` (1536 dimensions). The vector table is created for that size. Changing the embedding model requires a new database file.

## Layout

| Path | Role |
| --- | --- |
| `src/app/api/github/webhook/route.ts` | Verifies the webhook and starts a review |
| `src/lib/github.ts` | App JWT, installation token, diff fetch, review post |
| `src/lib/indexer.ts` | Downloads a commit, chunks it, stores embeddings |
| `src/lib/treesitter.ts` | Splits source into symbols |
| `src/lib/review.ts` | Review prompt and model tool loop |
| `src/lib/db.ts` | Opens SQLite and creates the schema |
| `data/openrabbit.sqlite` | Created on first use. Gitignored. |
