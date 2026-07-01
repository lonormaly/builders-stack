// @stack/ai-worker — background job runner (no HTTP server).
// Drains a queue and runs jobs that call @stack/ai. Graceful start/stop.
import { ai } from "@stack/ai";
import { createInMemoryQueue } from "./queue.js";

// ---- sample job: summarize text with the AI client ----
interface SummarizeJob {
  postId: string;
  text: string;
}

const queue = createInMemoryQueue<SummarizeJob>("summarize", { maxRetries: 2 });

async function handleSummarize(data: SummarizeJob, job: { id: string; attempt: number }) {
  console.log(`[ai-worker] ${job.id} summarizing post ${data.postId} (attempt ${job.attempt})`);
  const { text } = await ai.generate({
    system: "You summarize text in one sentence.",
    prompt: data.text,
    maxTokens: 100,
  });
  console.log(`[ai-worker] ${job.id} → ${text}`);
  // in a real worker: persist the summary via @stack/db here.
}

// ---- lifecycle ----
let stopping = false;
function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`[ai-worker] ${signal} received — draining, then exit`);
  queue.stop();
  // give the in-flight job a moment, then exit
  setTimeout(() => process.exit(0), 200);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

console.log("[ai-worker] started");

// Demo: enqueue one job so `bun dev` shows the loop working end to end.
// Replace with a real producer (API enqueues, or BullMQ picks up Redis jobs).
if (process.env.AI_WORKER_DEMO !== "0") {
  queue.add({
    postId: "p_demo",
    text: "The builders-stack is a reference monorepo for shipping fast.",
  });
}

await queue.run(handleSummarize); // resolves when stop() is called
