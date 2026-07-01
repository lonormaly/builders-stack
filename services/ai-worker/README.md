# @stack/ai-worker

Background job runner — **no HTTP server**. Drains a queue and runs jobs that call `@stack/ai`.

```bash
bun --filter @stack/ai-worker dev     # starts the loop; Ctrl-C for graceful stop
```

On boot it enqueues one demo `summarize` job so you can see the loop work end to end
(set `AI_WORKER_DEMO=0` to skip).

## Shape

- **`queue.ts`** — `Queue<T>` abstraction with an in-memory FIFO implementation
  (sequential processing, linear-backoff retries). Zero infra for local dev.
- **`index.ts`** — one sample job (`summarize`) calling `@stack/ai`, plus
  `SIGINT`/`SIGTERM` graceful shutdown.

## Prod swap: BullMQ + Redis

Implement the same `Queue<T>` interface over BullMQ and the worker code stays put:

```ts
// queue.bullmq.ts
import { Queue as BullQueue, Worker } from "bullmq";
export function createBullQueue<T>(name: string): Queue<T> {
  const q = new BullQueue<T>(name, { connection: { url: process.env.REDIS_URL } });
  return {
    name,
    add: (data) => {
      q.add(name, data);
      return name;
    },
    size: async () => q.count(),
    run: (handler) =>
      new Promise(
        () =>
          new Worker<T>(
            name,
            (job) => handler(job.data, { id: job.id!, attempt: job.attemptsMade }),
            { connection: { url: process.env.REDIS_URL } },
          ),
      ),
    stop: () => q.close(),
  };
}
```

Swap the `createInMemoryQueue(...)` call in `index.ts` for `createBullQueue(...)`. Nothing else changes.
