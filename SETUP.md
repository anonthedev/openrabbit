# Self-hosting OpenRabbit

OpenRabbit runs as one Node process. GitHub sends pull request webhooks to it. The process answers immediately, then indexes the base commit and posts a review. Keep the process running, and keep `data/` and the private key on disk across restarts.

## What you need

- A machine running Linux with Node.js 20.9 or newer. macOS works for local development.
- pnpm 11.1.1
- `build-essential` and `python3` so native modules can compile
- A domain name and HTTPS in front of the process. GitHub only delivers webhooks to a public HTTPS URL.
- An [OpenRouter](https://openrouter.ai) account and API key
- Permission to create a GitHub App on your user or organization, and to install it on the repositories you want reviewed

The documented production layout is: Caddy (or another reverse proxy) terminates TLS and proxies to `next start` on port 3000, started from the project root so `node_modules`, `.env`, the private key, and `data/` all resolve.

Do not deploy this as a serverless function. The review continues after the HTTP response, and the index is a local SQLite file.

## 1. Create the GitHub App

Open [github.com/settings/apps/new](https://github.com/settings/apps/new) for a user-owned app, or `https://github.com/organizations/<org>/settings/apps/new` for an organization.

Fill in the form as follows.

**Name and URLs**

- GitHub App name: any unique name, for example `openrabbit`
- Homepage URL: the public URL of this server, for example `https://review.example.com`
- Leave "Callback URL" empty. OpenRabbit does not use OAuth.
- Leave "Request user authorization (OAuth) during installation" unchecked.
- Leave "Redirect on update" unchecked.
- Leave Setup URL empty.

**Webhook**

- Check **Active**.
- Webhook URL: `https://review.example.com/api/github/webhook` (your host, this path).
- Webhook secret: generate one and save it. You will put the same value in `GITHUB_WEBHOOK_SECRET`.

```bash
openssl rand -hex 32
```

**Permissions**

Under **Repository permissions**:

| Permission | Access | Why |
| --- | --- | --- |
| Contents | Read-only | Download the base commit tarball |
| Pull requests | Read and write | Read the diff and post the review |

Metadata is set to Read-only automatically. Leave every other permission at No access.

**Subscribe to events**

Check **Pull request**. Leave the other events unchecked.

OpenRabbit acts on `opened`, `synchronize` (new commits pushed to the branch), and `reopened`.

**Where can this GitHub App be installed?**

Choose "Only on this account" if you are reviewing your own repositories. Choose "Any account" if other people or organizations will install it.

Click **Create GitHub App**.

On the app settings page, copy the **App ID**. That value is `GITHUB_APP_ID`.

Scroll to **Private keys** and click **Generate a private key**. GitHub downloads a `.pem` file. You get this file once. Store it with the server; it is the credential the app uses to mint installation tokens.

## 2. Install the app on repositories

In the app settings sidebar, open **Install App**.

Install it on the user or organization that owns the repositories. Choose **Only select repositories** and pick the ones OpenRabbit should review, or choose **All repositories**.

If you later add the Contents or Pull requests permission, GitHub shows a permissions update on the installation. Accept it or API calls from the app fail.

## 3. Prepare the machine

On Debian or Ubuntu:

```bash
sudo apt update
sudo apt install -y build-essential python3 ca-certificates curl
```

Install Node.js 20.9 or newer, then activate the pnpm version pinned in `package.json`:

```bash
corepack enable
corepack prepare pnpm@11.1.1 --activate
node -v
pnpm -v
```

`pnpm -v` should print `11.1.1`.

## 4. Install OpenRabbit

```bash
git clone <your-openrabbit-repo-url> openrabbit
cd openrabbit
pnpm install
```

`pnpm install` builds `better-sqlite3` and `sqlite-vec`. If that step fails, the compiler toolchain from step 3 is missing, or Node was upgraded after install. Rebuild with:

```bash
pnpm rebuild better-sqlite3 sqlite-vec
```

Put the private key somewhere the process can read. A path outside the repo is fine. Restrict it to the user that will run the server:

```bash
install -m 600 /path/to/downloaded-key.pem /home/openrabbit/openrabbit.pem
```

`*.pem` is gitignored. Do not commit the key.

Create `.env` in the project root:

```bash
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY_PATH=/home/openrabbit/openrabbit.pem
GITHUB_WEBHOOK_SECRET=the-secret-from-the-github-app-form
OPENROUTER_API_KEY=sk-or-v1-...
```

`.env*` is gitignored. Create the OpenRouter key at [openrouter.ai/keys](https://openrouter.ai/keys). The key needs to call:

- `openai/text-embedding-3-small` while indexing
- `openai/gpt-4o-mini` while reviewing

`GITHUB_PRIVATE_KEY_PATH` may be relative. `./openrabbit.pem` is resolved from the project root when you start the server there.

The database is created automatically at `data/openrabbit.sqlite` the first time a review indexes a commit. You do not run a migration. `data/` is gitignored. Back this file up if you want to keep the index across machine moves. Delete it to force every base commit to be indexed again.

## 5. Run it

Development, with hot reload, still from the project root:

```bash
pnpm dev
```

Production:

```bash
pnpm build
pnpm start
```

`pnpm start` listens on port 3000. Set a different port with `pnpm start -- -p 8080` or `PORT=8080 pnpm start`.

Leave `node_modules` in place. Tree-sitter loads `.wasm` grammars from those packages at review time, and `better-sqlite3` / `sqlite-vec` are native addons. `pnpm build` does not produce a standalone bundle that can run without them.

## 6. Expose the webhook over HTTPS

GitHub must reach `POST /api/github/webhook` on port 443 with a certificate it trusts.

**Production.** Point DNS for `review.example.com` at the server. With [Caddy](https://caddyserver.com/), which obtains a certificate automatically:

```
review.example.com {
	reverse_proxy 127.0.0.1:3000
}
```

Open inbound TCP 443 (and 80, so Caddy can complete the certificate challenge). Confirm the app is up:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://review.example.com/api/github/webhook
```

A request with no signature returns `401`. That is the route answering.

**Local development.** GitHub cannot call `localhost`. Run a tunnel to port 3000 and temporarily set the GitHub App webhook URL to the tunnel URL plus `/api/github/webhook`. For example, with Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:3000
```

Use the printed `https://….trycloudflare.com/api/github/webhook` as the webhook URL. Update the URL again when the tunnel address changes. Keep the webhook secret the same.

## 7. Keep the process running

`pnpm start` must stay up for the whole review. A process manager should restart it and use the project root as the working directory.

Example systemd unit, `/etc/systemd/system/openrabbit.service`:

```ini
[Unit]
Description=OpenRabbit
After=network.target

[Service]
Type=simple
User=openrabbit
WorkingDirectory=/home/openrabbit/openrabbit
Environment=NODE_ENV=production
ExecStart=/usr/bin/pnpm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`User` must be able to read `.env`, the `.pem` file, and write `data/`. If `pnpm` is not at `/usr/bin/pnpm`, use the path from `command -v pnpm`.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now openrabbit
journalctl -u openrabbit -f
```

A successful index logs a line like `indexed 42 files at <sha>`.

## 8. Confirm a review

1. In the GitHub App settings, open **Advanced** → **Recent Deliveries**. Redeliver an old delivery or open a new pull request on an installed repository.
2. A delivery to the right URL shows a `200` response with body `ok`. `401` means the webhook secret on GitHub and `GITHUB_WEBHOOK_SECRET` differ. A connection error means the URL, DNS, firewall, or proxy is wrong.
3. On the server log, wait for the index line, then for the review request to finish. Indexing downloads the repository and embeds every symbol, so the first review of a commit takes longer than later ones.
4. The pull request shows a comment review from the app.

`synchronize` deliveries (a push to the pull request branch) start another review. The base commit is skipped when that SHA is already in the `commits` table.

## Operations

**Disk.** `data/openrabbit.sqlite` grows by one indexed commit at a time: file paths, symbol chunks, and a 1536-float vector per chunk. Nothing deletes old SHAs. Watch the file size on repositories you review often.

**Memory.** The base-commit tarball is read fully into memory before it is unpacked. Size the machine for the largest repository you install the app on.

**Secrets.** `GITHUB_WEBHOOK_SECRET`, the `.pem` file, and `OPENROUTER_API_KEY` are the credentials. Rotating the webhook secret means updating both GitHub and `.env`, then restarting the process. Rotating the key means generating a new private key on the app, replacing the file, and restarting. GitHub App private keys overlap until you delete the old one.

**Upgrades.** Pull the new code, run `pnpm install` and `pnpm build`, then restart the process. The schema is created with `IF NOT EXISTS` on startup. Replacing the embedding model is a schema change: stop the process, move `data/openrabbit.sqlite` aside, and let the next review create a new file.

**Logs when a comment never appears.** The webhook can return `200` while the review fails afterward. Check the process log for GitHub or OpenRouter error text. Typical causes: the installation has not accepted updated permissions, the private key path is wrong relative to the working directory, the OpenRouter key is missing or out of credit, or the process exited before the review finished.
