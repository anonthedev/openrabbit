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

  const messages: Message[] = [
    {
      role: "system",
      content: "Review this pull request. Search before you conclude.",
    },
    { role: "user", content: diff },
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
