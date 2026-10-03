import { createHmac, createSign, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";

export type PullRequestPayload = {
  action?: string;
  installation?: { id: number };
  repository?: { name: string; owner: { login: string } };
  pull_request?: {
    number: number;
    title: string;
    body: string;
    head: { sha: string };
    base: { sha: string };
  };
};

export function githubHeaders(token: string, extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "open-rabbit",
    "X-GitHub-Api-Version": "2026-03-10",
    ...extra,
  };
}

export function appJwt() {
  const appId = process.env.GITHUB_APP_ID;
  const keyPath = process.env.GITHUB_PRIVATE_KEY_PATH;
  if (!appId || !keyPath) throw new Error("Missing GitHub App credentials");

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }),
  ).toString("base64url");
  const data = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(data);
  return `${data}.${signer.sign(readFileSync(keyPath)).toString("base64url")}`;
}

export function isValidSignature(body: Buffer, signature: string | null) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  const actual = Buffer.from(signature);
  const digest = Buffer.from(expected);
  if (actual.length !== digest.length) return false;
  return timingSafeEqual(actual, digest);
}

export async function installationToken(installationId: number) {
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: githubHeaders(appJwt()),
    },
  );
  if (!response.ok) throw new Error(await response.text());
  const { token } = (await response.json()) as { token: string };
  return token;
}

export async function postReview(
  token: string,
  owner: string,
  repo: string,
  number: number,
  sha: string,
  body: string,
) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}/reviews`, {
    method: "POST",
    headers: githubHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      commit_id: sha,
      event: "COMMENT",
      token,
      body
    }),
  });
  if (!response.ok) throw new Error(await response.text());
}

export async function getPullRequestDiff(token: string, owner: string, repo: string, number: number) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}`, {
    headers: githubHeaders(token, { Accept: "application/vnd.github.diff" }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.text();
}