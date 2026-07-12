import { createAuthClient } from "better-auth/react";

// baseURL = the API origin. Better Auth appends its default basePath (/api/auth),
// so requests land on @stack/api's /api/auth/* handler. Configurable, local default.
// Exported so the social popup flow can POST /sign-in/social directly (see auth/page.tsx).
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const authClient = createAuthClient({
  baseURL: API_URL,
  // web (:3000) and api (:3001) are different origins → session cookie is cross-origin.
  // `credentials: "include"` sends it; the API must allow this origin with
  // credentials + list it in Better Auth `trustedOrigins` (server-side contract).
  fetchOptions: { credentials: "include" },
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
