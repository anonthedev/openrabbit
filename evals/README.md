# Review evals

This scores the review in `src/lib/review.ts`. A case is one pull request. The model sees the title, the description, each changed file with its path and line numbers, and the diff. It does not see the label.

## Catch

Each case has one label: a file, a line in the file after the diff, the text of that line (`anchor`), and the failure that line causes (`impact`).

A review catches the bug only when it does both:

1. Points at that line. Quoting `anchor`, or naming the file and the line number, counts. A summary that describes the bug and never identifies the line does not.
2. States the same failure as `impact`. The words do not have to match. Overlap scores such as BLEU are not used. They reward restating the diff.

The app posts one review body, not inline comments, so the body itself has to identify the line.

## Noise

These do not count as a catch, and they count against precision:

- style, naming, wording, formatting, or anything a linter would catch
- a restatement of the diff that names no failure
- a second fault this case does not label

A review that catches the labeled bug and also nits still catches the bug. The nit is a separate noise finding.

## Run

Put `OPENROUTER_API_KEY` in `.env`. From the repo root:

```
pnpm eval
```

That sends each case to `openai/gpt-4o-mini` with the same prompt and `searchCode` tool as a live review. The user message includes each changed file, numbered, under a `File:` path, then the diff. A search returns those files. The label is not sent to the reviewer.

A second call scores the review. A catch requires the review to locate the labeled line and to describe the labeled failure. The words do not have to match. Recall is catches out of the cases run. Precision is catches out of catches plus noise findings.

One case:

```
pnpm eval planted-03-user-search
```

Reviews land in `evals/runs/<timestamp>/`. Score saved reviews again without calling the reviewer:

```
pnpm eval -- --rescore evals/runs/<timestamp>
```

## This file

`cases.json` is 10 short hand-written diffs. Each diff introduces one high or critical bug or security fault, and that fault is visible in the diff. `source` is `planted`. `line` is the line a fix would edit.

Not in this slice:

- Real bug-fix pull requests replayed in reverse. The diff is the change that introduced the bug. The label is the line the later fix edited. Same record, with `source` set to `reverse` and the introducing pull request and the fix commit filled in.
- Martian's 50 pull requests. Keep comments whose severity is High or Critical and whose category is bug or security. Drop style and speculative comments. Those fight the prompt, which treats an empty set of findings as a successful review.
- Clean diffs, so a review that says the pull request looks fine can be scored.
- Duplication and pattern cases. Those need the base tree, because the review is supposed to call `searchCode` before it claims something already exists.
