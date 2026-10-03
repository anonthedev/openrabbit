import { indexBaseCommit } from "@/lib/indexer";
import {
  getPullRequestDiff,
  installationToken,
  postReview,
  type PullRequestPayload,
} from "@/lib/github";

import { openDb } from "@/lib/db";

type Message = {
  role: string;
  content: string | null;
  tool_calls?: unknown;
  tool_call_id?: string;
};

const tools = [
  {
    type: "function",
    function: {
      name: "searchCode",
      description: "Find base-commit code related to a short query.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
];

function searchCode(owner: string, repo: string, baseSha: string) {
  return async (query: string) => {
    const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/text-embedding-3-small",
        input: query,
      }),
    });

    if (!response.ok) throw new Error(await response.text());
    const { data } = (await response.json()) as {
      data: { embedding: number[] }[];
    };

    const db = openDb();
    const results = db
      .prepare(
        `SELECT chunks.path, chunks.symbol, chunks.start_line, chunks.end_line, chunks.text
          FROM (
            SELECT rowid
            FROM chunk_vectors
            WHERE embedding MATCH ? AND k = 5
          ) AS matches
          JOIN chunks ON chunks.id = matches.rowid
          WHERE chunks.owner = ? AND chunks.repo = ? AND chunks.sha = ?`,
      )
      .all(new Float32Array(data[0].embedding), owner, repo, baseSha);
    return results;
  };
}

const REVIEW_PROMPT = `You are a senior engineer reviewing a pull request. You think before you speak. You are not a linter, a copy editor, or a style bot.

Your comment is posted as the pull request review body. Write GitHub-flavored Markdown. Start with a one-line TL;DR.

Search the base commit with searchCode before you conclude about existing behavior, duplication, or whether a pattern already exists. The diff is the code under review. Do not assume runtime code differs from it.

## Only comment on what can actually matter

Speak only when at least one of these is true:
- It introduces a bug or a likely runtime error
- It is a security issue, including a subtle one
- It duplicates something that already exists
- It changes something outside the PR's stated goal
- It will break at real load or scale
- It fights an established pattern in this codebase in a way that will cause a real problem
- It is confusing enough that the next person will misuse it

If none of those apply, say the PR looks fine in a few sentences and stop. An empty set of findings is a successful review.

Do not comment on:
- Missing commas, typos, punctuation, or wording in READMEs, comments, strings, or docs
- Naming preferences, import order, whitespace, formatting, or anything a linter would catch
- Hypothetical problems you cannot tie to this diff
- Praise that restates the change
- Style that already matches the codebase

Skip lockfiles, generated files, minified files, and vendor code. Do not summarize whitespace-only diffs.

## How to review

1. Read the title, description, and the full diff. Name the one thing the author is trying to add or fix.
2. Classify each changed file as core, support, unrelated, or shared infrastructure (auth, schema, config, public API). If a file was not required for the goal, say so and suggest splitting it out. If shared infrastructure changed, ask why.
3. If the diff adds a client, auth flow, parser, or config loader, search first. Point at the existing function if one already does the job. A second AI or HTTP client next to an existing one is a real finding.
4. Ask about intent when you are unsure. Questions beat accusations.
5. When you are confident in a small fix, give it as a GitHub suggestion block the author can apply:

\`\`\`suggestion
corrected code
\`\`\`

Only suggest code you would apply yourself. Never put a multi-file refactor in one suggestion.

Match the length to the diff. A one-line change gets a few sentences. A large change gets a short summary plus the risks that matter: correctness, security, migration, compatibility. Use headings and a short action list only when there is something to do.

Priority when several things are wrong: security, then correctness, then scope, then duplication. Batch comments that share a cause. Leave out the rest.`;

export async function reviewPullRequest(payload: PullRequestPayload) {
  const installationId = payload.installation?.id;
  const owner = payload.repository?.owner.login;
  const repo = payload.repository?.name;
  const number = payload.pull_request?.number;
  const sha = payload.pull_request?.head.sha;

  if (!installationId || !owner || !repo || !number || !sha) return;

  const token = await installationToken(installationId);

  const diff = await getPullRequestDiff(token, owner, repo, number);

  const baseSha = payload.pull_request?.base.sha;
  if (!baseSha) return;

  await indexBaseCommit(token, owner, repo, baseSha);

  const title = payload.pull_request?.title ?? "";
  const description = payload.pull_request?.body?.trim() || "No description provided.";

  const messages: Message[] = [
    { role: "system", content: REVIEW_PROMPT },
    {
      role: "user",
      content: `PR title: ${title}\n\nPR description:\n${description}\n\nDiff:\n${diff}`,
    },
  ];

  for (let round = 0; round < 4; round++) {
    const completion = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "openai/gpt-4o-mini", messages, tools }),
      },
    ).then((response) => response.json());

    const message = completion.choices[0].message;
    messages.push(message);

    if (!message.tool_calls?.length) {
      if (message.content) {
        await postReview(token, owner, repo, number, sha, message.content);
      }
      return;
    }
    const search = searchCode(owner, repo, baseSha);

    for (const call of message.tool_calls) {
      const { query } = JSON.parse(call.function.arguments);
      const hits = await search(query);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(hits),
      });
    }
  }
}
