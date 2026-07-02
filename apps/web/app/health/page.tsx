import { Badge, Card, CardContent, CardHeader, CardTitle } from "@stack/ui";
import { pageMetadata } from "@stack/seo";
// The API contract, shared with services/api. `Post` is inferred from the SAME zod
// schema the server validates against — so this fetch is type-safe with zero drift.
// (`import type` erases at build: the browser never pulls zod/@stack/api-types.)
import type { Post } from "@stack/api-types";

// Cross-role wiring: apps/web (a UI role) calls services/api (a URL role) over HTTP.
// Configurable, with a sensible local default — never hardcode the origin.
const API_URL = process.env.API_URL ?? "http://localhost:3001";

// Don't try to reach the API during `next build` — resolve it per request instead.
export const dynamic = "force-dynamic";

// A diagnostics page — server-rendered, but keep it out of the index (noIndex).
export const metadata = pageMetadata({ title: "API health", path: "/health", noIndex: true });

type HealthResult =
  | { reachable: true; status: number; body: unknown }
  | { reachable: false; error: string };

async function getHealth(): Promise<HealthResult> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
    const body: unknown = await res
      .clone()
      .json()
      .catch(() => res.text());
    return { reachable: true, status: res.status, body };
  } catch (err) {
    return {
      reachable: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Type-safe call: the result is `Post[]` because that's the shared contract.
async function getPosts(): Promise<Post[]> {
  try {
    const res = await fetch(`${API_URL}/posts`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as Post[]) : [];
  } catch {
    return [];
  }
}

export default async function HealthPage() {
  const [health, posts] = await Promise.all([getHealth(), getPosts()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">API health</h1>
        <p className="text-muted-foreground">
          <code>apps/web</code> → <code>@stack/api</code> at <code>{API_URL}/health</code>
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>GET /health</CardTitle>
          {health.reachable ? (
            <Badge>reachable · {health.status}</Badge>
          ) : (
            <Badge variant="destructive">unreachable</Badge>
          )}
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm text-muted-foreground">
            {health.reachable
              ? JSON.stringify(health.body, null, 2)
              : `Could not reach the API.\n${health.error}\n\nStart it with ./tilt_up.sh (or: bun --filter @stack/api dev).`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>GET /posts</CardTitle>
          <Badge variant="outline">
            {posts.length} post{posts.length === 1 ? "" : "s"} · typed as Post[]
          </Badge>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {posts.length === 0 ? (
              <li>No posts yet — POST one via /docs, or start the API.</li>
            ) : (
              posts.map((p) => (
                <li key={p.id}>
                  <span className="text-foreground">{p.title}</span> ·{" "}
                  {new Date(p.createdAt).toLocaleDateString()}
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
