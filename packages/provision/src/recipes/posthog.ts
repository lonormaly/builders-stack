import type { Recipe, ValidateResult } from "../recipe";

// PostHog recipe — guided mode.
//
// envVars filled:
//   NEXT_PUBLIC_POSTHOG_KEY  — the project API key (public, goes in .env)
//   NEXT_PUBLIC_POSTHOG_HOST — the ingestion host (defaults to https://us.i.posthog.com)
//
// rootCredKeys:
//   POSTHOG_PERSONAL_API_KEY — a personal API key used ONLY to validate; reused across
//                              repos and stored in ~/.builders-stack. Never committed.
//
// validate(): GET https://us.posthog.com/api/projects/ with the personal key as a
// Bearer token. A 200 response confirms auth; we also confirm the project key prefix
// (phc_) as a sanity check on the public var. No autoProvision — PostHog project +
// API keys are created by the user in the dashboard.

export const recipe: Recipe = {
  id: "posthog",
  title: "PostHog",
  mode: "guided",

  envVars: ["NEXT_PUBLIC_POSTHOG_KEY", "NEXT_PUBLIC_POSTHOG_HOST"],

  // The personal API key lives in the root store (shared across repos).
  // The project key and host are per-repo .env values.
  rootCredKeys: ["POSTHOG_PERSONAL_API_KEY"],

  tokenCreateUrl: "https://us.posthog.com/settings/user-api-keys",
  docsUrl: "https://posthog.com/docs/api",

  requiredScopes: ["Read project (to validate credentials via /api/projects/)"],

  async validate(creds: Record<string, string>): Promise<ValidateResult> {
    const personalKey = creds["POSTHOG_PERSONAL_API_KEY"];
    const projectKey = creds["NEXT_PUBLIC_POSTHOG_KEY"];

    if (!personalKey) {
      return { ok: false, detail: "POSTHOG_PERSONAL_API_KEY is required to validate" };
    }

    // Sanity-check project key format before hitting the network.
    if (projectKey && !projectKey.startsWith("phc_")) {
      return {
        ok: false,
        detail: `NEXT_PUBLIC_POSTHOG_KEY looks wrong — PostHog project keys start with "phc_" (got: ${projectKey.slice(0, 8)}…)`,
      };
    }

    // Real API probe: list projects accessible to this personal key.
    let res: Response;
    try {
      res = await fetch("https://us.posthog.com/api/projects/", {
        headers: { Authorization: `Bearer ${personalKey}` },
      });
    } catch (err) {
      return { ok: false, detail: `Network error: ${(err as Error).message}` };
    }

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        detail: `${res.status} — personal API key rejected (invalid or expired)`,
      };
    }

    if (!res.ok) {
      return { ok: false, detail: `Unexpected ${res.status} from PostHog /api/projects/` };
    }

    let body: { results?: Array<{ id: number; name: string }> };
    try {
      body = (await res.json()) as typeof body;
    } catch {
      return { ok: false, detail: "PostHog returned non-JSON — unexpected response" };
    }

    const projects = body.results ?? [];
    const projectList = projects.map((p) => p.name).join(", ") || "(none)";
    const detail = `Authenticated. Accessible projects: ${projectList}`;

    return {
      ok: true,
      detail,
      scopes: ["read:projects"],
    };
  },
};

export default recipe;
