// Example resource: `posts` — zod-validated CRUD, OpenAPI-documented,
// backed by @stack/db (Drizzle). This is the pattern to copy for real resources.
import { createRoute, z } from "@hono/zod-openapi";
import { db, posts, eq } from "@stack/db";
import type { Post, NewPost } from "@stack/db";
// The request/response schemas live in @stack/api-types — the ONE contract shared
// with apps/web. Here they drive validation + OpenAPI; there they drive typed calls.
import { PostSchema, NewPostSchema, PatchPostSchema, IdParam, ErrorSchema } from "@stack/api-types";

const json = <T extends z.ZodTypeAny>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});

// serialize a DB row (Date) into the API shape (ISO string)
const toApi = (p: Post) => ({
  ...p,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

// ---- routes ----
export const listRoute = createRoute({
  method: "get",
  path: "/posts",
  tags: ["posts"],
  responses: { 200: json(z.array(PostSchema), "All posts") },
});

export const createPostRoute = createRoute({
  method: "post",
  path: "/posts",
  tags: ["posts"],
  request: { body: { content: { "application/json": { schema: NewPostSchema } } } },
  // authorId is set from the session server-side, never from the body (see index.ts).
  responses: {
    201: json(PostSchema, "Created post"),
    401: json(ErrorSchema, "Unauthorized"),
  },
});

export const getRoute = createRoute({
  method: "get",
  path: "/posts/{id}",
  tags: ["posts"],
  request: { params: IdParam },
  responses: { 200: json(PostSchema, "The post"), 404: json(ErrorSchema, "Not found") },
});

export const patchRoute = createRoute({
  method: "patch",
  path: "/posts/{id}",
  tags: ["posts"],
  request: {
    params: IdParam,
    body: { content: { "application/json": { schema: PatchPostSchema } } },
  },
  responses: {
    200: json(PostSchema, "Updated post"),
    401: json(ErrorSchema, "Unauthorized"),
    403: json(ErrorSchema, "Forbidden — not the author"),
    404: json(ErrorSchema, "Not found"),
  },
});

export const deleteRoute = createRoute({
  method: "delete",
  path: "/posts/{id}",
  tags: ["posts"],
  request: { params: IdParam },
  responses: {
    204: { description: "Deleted" },
    401: json(ErrorSchema, "Unauthorized"),
    403: json(ErrorSchema, "Forbidden — not the author"),
    404: json(ErrorSchema, "Not found"),
  },
});

// ---- data access (idiomatic Drizzle; @stack/db provides db + schema) ----
const one = (rows: Post[]): Post | undefined => rows[0];

export const repo = {
  list: async (): Promise<Post[]> => (await db.select().from(posts)) as Post[],
  get: async (id: string): Promise<Post | undefined> =>
    one((await db.select().from(posts).where(eq(posts.id, id))) as Post[]),
  create: async (input: NewPost): Promise<Post> => {
    const row = one((await db.insert(posts).values(input).returning()) as Post[]);
    if (!row) throw new Error("insert returned no row");
    return row;
  },
  update: async (id: string, patch: Partial<NewPost>): Promise<Post | undefined> =>
    one((await db.update(posts).set(patch).where(eq(posts.id, id)).returning()) as Post[]),
  remove: async (id: string): Promise<boolean> =>
    ((await db.delete(posts).where(eq(posts.id, id)).returning()) as Post[]).length > 0,
};

export { toApi };
