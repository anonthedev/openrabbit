import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { REVIEW_PROMPT } from "../src/lib/reviewPrompt.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const model = "openai/gpt-4o-mini";

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

const JUDGE_PROMPT = `You decide whether a pull request review caught one labeled bug. Different words are fine. Do not require the review to quote the source line.

points_at_line is true when the review identifies the faulty code, by file and line, by quote, or by describing that expression. It is false when the review treats that code as correct.

states_failure is true when the review describes the labeled failure. It is false when the review says the change is correct, or when it describes a different problem.

noise is an array of short strings. Include only a complaint the review actually makes that is not the labeled bug. Do not include the labeled bug or a fix for it. A review that approves the change has an empty array. Strings only, not objects.

Reply with JSON only:
{"points_at_line":false,"states_failure":false,"noise":[],"reason":""}`;

function loadKey() {
  if (process.env.OPENROUTER_API_KEY) return;
  let text = "";
  try {
    text = readFileSync(join(root, ".env"), "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*OPENROUTER_API_KEY\s*=\s*(.*)\s*$/);
    if (!match) continue;
    process.env.OPENROUTER_API_KEY = match[1].replace(/^["']|["']$/g, "");
  }
}

function numbered(source) {
  return source
    .replace(/\n$/, "")
    .split("\n")
    .map((line, index) => `${String(index + 1).padStart(4, " ")} | ${line}`)
    .join("\n");
}

function fileBlocks(item) {
  return Object.entries(item.files)
    .map(([path, source]) => `File: ${path}\n${numbered(source)}`)
    .join("\n\n");
}

function searchHits(item) {
  return Object.entries(item.files).map(([path, source]) => {
    const lines = source.replace(/\n$/, "").split("\n");
    return {
      path,
      symbol: path.split("/").pop(),
      start_line: 1,
      end_line: lines.length,
      text: source,
    };
  });
}

async function complete(messages, withTools) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      ...(withTools ? { tools } : { response_format: { type: "json_object" } }),
    }),
  });
  const completion = await response.json();
  if (!response.ok) {
    throw new Error(completion.error?.message || JSON.stringify(completion));
  }
  return completion.choices[0].message;
}

async function reviewCase(item) {
  const messages = [
    { role: "system", content: REVIEW_PROMPT },
    {
      role: "user",
      content: `PR title: ${item.title}\n\nPR description:\n${item.description}\n\n${fileBlocks(item)}\n\nDiff:\n${item.diff}`,
    },
  ];

  for (let round = 0; round < 4; round++) {
    const message = await complete(messages, true);
    messages.push(message);
    if (!message.tool_calls?.length) return message.content ?? "";

    for (const call of message.tool_calls) {
      const { query } = JSON.parse(call.function.arguments);
      const hits = searchHits(item);
      console.log(
        `  search ${JSON.stringify(query)} -> ${hits
          .map((hit) => `${hit.path}:${hit.start_line}`)
          .join(", ")}`,
      );
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(hits),
      });
    }
  }

  return "";
}

function findingText(item) {
  if (typeof item === "string") return item.trim();
  if (!item || typeof item !== "object") return "";
  for (const key of ["finding", "text", "description", "issue", "comment"]) {
    if (typeof item[key] === "string") return item[key].trim();
  }
  const values = Object.values(item).filter((value) => typeof value === "string");
  return values.length === 1 ? values[0].trim() : "";
}

function parseJudge(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error(text);
  const parsed = JSON.parse(text.slice(start, end + 1));
  const pointsAtLine = parsed.points_at_line === true;
  const statesFailure = parsed.states_failure === true;
  const noise = Array.isArray(parsed.noise) ? parsed.noise.map(findingText).filter(Boolean) : [];
  return {
    pointsAtLine,
    statesFailure,
    caught: pointsAtLine && statesFailure,
    noise,
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
  };
}

async function judgeCase(item, body) {
  if (!body.trim()) {
    return {
      pointsAtLine: false,
      statesFailure: false,
      caught: false,
      noise: [],
      reason: "The review was empty.",
    };
  }
  const message = await complete(
    [
      { role: "system", content: JUDGE_PROMPT },
      {
        role: "user",
        content: `File: ${item.label.path}\nLine: ${item.label.line}\nLine text: ${item.label.anchor}\nFailure: ${item.label.impact}\n\nReview:\n${body}`,
      },
    ],
    false,
  );
  return parseJudge(message.content ?? "");
}

loadKey();
if (!process.env.OPENROUTER_API_KEY) {
  console.error("Set OPENROUTER_API_KEY in .env, then run pnpm eval");
  process.exit(1);
}

const cases = JSON.parse(readFileSync(join(root, "evals/cases.json"), "utf8"));
const rescoreIndex = process.argv.indexOf("--rescore");
if (rescoreIndex !== -1) {
  const runDir = process.argv[rescoreIndex + 1];
  if (!runDir) {
    console.error("pnpm eval -- --rescore evals/runs/<timestamp>");
    process.exit(1);
  }
  const rows = [];
  for (const item of cases) {
    const text = readFileSync(join(runDir, `${item.id}.md`), "utf8");
    const body = text.split("## Review\n\n")[1]?.trim() ?? "";
    console.log(item.id);
    const score = await judgeCase(item, body);
    rows.push({ id: item.id, ...score });
    console.log(
      `  ${score.caught ? "catch" : "miss"} | line ${score.pointsAtLine ? "yes" : "no"} | failure ${score.statesFailure ? "yes" : "no"} | noise ${score.noise.length}`,
    );
  }
  const caught = rows.filter((row) => row.caught).length;
  const noise = rows.reduce((sum, row) => sum + row.noise.length, 0);
  console.log(`\nrecall ${caught}/${rows.length}`);
  console.log(noise + caught === 0 ? "precision n/a" : `precision ${caught}/${caught + noise}`);
  process.exit(0);
}

const wanted = process.argv.slice(2);
const selected = cases.filter((item) => wanted.length === 0 || wanted.includes(item.id));
if (selected.length === 0) {
  console.error(`No case matched ${wanted.join(", ")}`);
  process.exit(1);
}

const runDir = join(root, "evals/runs", new Date().toISOString().replace(/[:.]/g, "-"));
mkdirSync(runDir, { recursive: true });

const rows = [];
for (const item of selected) {
  console.log(item.id);
  const body = await reviewCase(item);
  const score = await judgeCase(item, body);
  writeFileSync(
    join(runDir, `${item.id}.md`),
    `# ${item.id}\n\nLabel: ${item.label.path}:${item.label.line}\n\nCaught: ${score.caught ? "yes" : "no"}\n\nPoints at line: ${score.pointsAtLine ? "yes" : "no"}\n\nStates failure: ${score.statesFailure ? "yes" : "no"}\n\nNoise: ${score.noise.length === 0 ? "none" : score.noise.join("; ")}\n\nJudge: ${score.reason}\n\n## Review\n\n${body}\n`,
  );
  rows.push({ id: item.id, ...score });
  console.log(
    `  ${score.caught ? "catch" : "miss"} | line ${score.pointsAtLine ? "yes" : "no"} | failure ${score.statesFailure ? "yes" : "no"} | noise ${score.noise.length}`,
  );
}

const caught = rows.filter((row) => row.caught).length;
const noise = rows.reduce((sum, row) => sum + row.noise.length, 0);
const precisionDenom = caught + noise;
writeFileSync(
  join(runDir, "summary.json"),
  JSON.stringify(
    {
      recall: caught / rows.length,
      precision: precisionDenom === 0 ? null : caught / precisionDenom,
      caught,
      total: rows.length,
      noise,
      cases: rows,
    },
    null,
    2,
  ) + "\n",
);
console.log(`\nrecall ${caught}/${rows.length}`);
console.log(precisionDenom === 0 ? "precision n/a" : `precision ${caught}/${precisionDenom}`);
console.log(runDir);
