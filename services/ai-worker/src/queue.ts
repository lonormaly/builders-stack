// Minimal typed job queue. In-memory by default (zero infra for local dev).
//
// ponytail: in-memory FIFO with sequential processing + retry. This is the whole
// abstraction the worker needs. Swap to BullMQ + Redis for prod (multi-process,
// persistence, scheduling) by implementing this same `Queue<T>` surface — the
// worker code below doesn't change. See README for the BullMQ swap.

export type JobHandler<T> = (data: T, job: { id: string; attempt: number }) => Promise<void>;

export interface QueueOptions {
  /** Retries after the first attempt before a job is dropped. Default 2. */
  maxRetries?: number;
  /** Base backoff ms between retries (linear). Default 500. */
  backoffMs?: number;
}

export interface Queue<T> {
  readonly name: string;
  add(data: T): string;
  /** Start draining. Resolves when the queue is stopped. */
  run(handler: JobHandler<T>): Promise<void>;
  stop(): void;
  size(): number;
}

interface Job<T> {
  id: string;
  data: T;
  attempt: number;
}

export function createInMemoryQueue<T>(name: string, opts: QueueOptions = {}): Queue<T> {
  const maxRetries = opts.maxRetries ?? 2;
  const backoffMs = opts.backoffMs ?? 500;
  const jobs: Job<T>[] = [];
  let seq = 0;
  let running = false;
  let wake: (() => void) | null = null;

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const notify = () => {
    if (wake) {
      wake();
      wake = null;
    }
  };

  return {
    name,
    size: () => jobs.length,
    add(data) {
      const id = `${name}:${++seq}`;
      jobs.push({ id, data, attempt: 0 });
      notify();
      return id;
    },
    stop() {
      running = false;
      notify();
    },
    async run(handler) {
      running = true;
      while (running) {
        const job = jobs.shift();
        if (!job) {
          // idle — wait until add() or stop() wakes us
          await new Promise<void>((resolve) => (wake = resolve));
          continue;
        }
        try {
          await handler(job.data, { id: job.id, attempt: job.attempt });
          console.log(`[queue:${name}] done ${job.id}`);
        } catch (err) {
          if (job.attempt < maxRetries) {
            job.attempt++;
            console.warn(`[queue:${name}] retry ${job.id} (attempt ${job.attempt}):`, err);
            await sleep(backoffMs * job.attempt);
            jobs.push(job);
          } else {
            console.error(`[queue:${name}] failed ${job.id} after ${job.attempt} retries:`, err);
          }
        }
      }
    },
  };
}
