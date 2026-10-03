import { isValidSignature, type PullRequestPayload } from "@/lib/github";
import { reviewPullRequest } from "@/lib/review";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = Buffer.from(await request.arrayBuffer());

  if (!isValidSignature(body, request.headers.get("x-hub-signature-256"))) {
    return new Response("invalid signature", { status: 401 });
  }

  const event = request.headers.get("x-github-event");
  const payload = JSON.parse(body.toString("utf8")) as PullRequestPayload;

  if (
    event === "pull_request" &&
    (payload.action === "opened" ||
      payload.action === "synchronize" ||
      payload.action === "reopened")
  ) {
    void reviewPullRequest(payload);
  }

  return new Response("ok", { status: 200 });
}
