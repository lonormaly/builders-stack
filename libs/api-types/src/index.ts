// @stack/api-types — the API contract, shared by BOTH sides of the wire.
//
//   services/api  imports the SCHEMAS to validate requests + generate OpenAPI.
//   apps/web      imports the inferred TYPES for type-safe calls (no runtime pull —
//                 `import type` erases, so the browser never loads zod from here).
//
// Boundary-safe: a lib that a service AND an app both depend on is still a downward
// dependency for each — no `lib → app/service` import. One contract, zero drift.
//
// The `z` here is @hono/zod-openapi's zod (plain zod + `.openapi()` metadata) so the
// same schema object doubles as the OpenAPI component definition.
import { z } from "@hono/zod-openapi";

export const PostSchema = z
  .object({
    id: z.string().openapi({ example: "p_abc123" }),
    title: z.string().openapi({ example: "Hello world" }),
    body: z.string().openapi({ example: "My first post." }),
    authorId: z.string().openapi({ example: "u_abc123" }),
    createdAt: z.string().datetime().openapi({ example: "2026-07-01T12:00:00.000Z" }),
    updatedAt: z.string().datetime().openapi({ example: "2026-07-01T12:00:00.000Z" }),
  })
  .openapi("Post");

// authorId is NOT in the write contract — it's derived server-side from the session
// (see services/api create handler). Accepting it from the client is broken object-level
// auth (BOLA): a caller could forge posts as any user. .max() bounds prevent unbounded
// text writes bloating Postgres past the request body cap.
export const NewPostSchema = z
  .object({
    title: z.string().min(1).max(255),
    body: z.string().min(1).max(100_000),
  })
  .openapi("NewPost");

export const PatchPostSchema = NewPostSchema.partial().openapi("PatchPost");

export const IdParam = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: "id", in: "path" } }),
});

export const ErrorSchema = z.object({ error: z.string() }).openapi("Error");

// Inferred types — what apps/web consumes for a type-safe fetch. `Post` is the API
// wire shape (ISO-string dates), distinct from @stack/db's row type (Date objects).
export type Post = z.infer<typeof PostSchema>;
export type NewPost = z.infer<typeof NewPostSchema>;
export type PatchPost = z.infer<typeof PatchPostSchema>;
