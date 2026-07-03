import type { Recipe, ValidateResult } from "../recipe.js";

/**
 * Creem recipe — guided mode.
 *
 * validate(): attempts GET /v1/products (a safe read-only list endpoint) with
 * Bearer CREEM_API_KEY. 200 → ok; 401/403 → not ok. If no safe GET is available
 * in a given Creem API version, falls back to a prefix/format check and says so.
 *
 * CREEM_WEBHOOK_SECRET is locally generated — no API probe possible; we only
 * check it's present and non-empty.
 */

const CREEM_API_BASE = "https://api.creem.io";

// Known prefixes for Creem live vs test keys (best-effort; not guaranteed by their docs).
const KEY_PREFIXES = ["creem_live_", "creem_test_", "creem_"];

export const recipe: Recipe = {
  id: "creem",
  title: "Creem",
  mode: "guided",
  envVars: ["CREEM_API_KEY", "CREEM_WEBHOOK_SECRET"],
  tokenCreateUrl: "https://dashboard.creem.io/settings/api-keys",
  docsUrl: "https://docs.creem.io",
  requiredScopes: ["Read products / customers (minimum read scope)"],
  rootCredKeys: ["CREEM_API_KEY"],

  async validate(creds: Record<string, string>): Promise<ValidateResult> {
    const apiKey = creds["CREEM_API_KEY"] ?? "";
    const webhookSecret = creds["CREEM_WEBHOOK_SECRET"] ?? "";

    if (!apiKey) {
      return { ok: false, detail: "CREEM_API_KEY is missing." };
    }
    if (!webhookSecret) {
      return { ok: false, detail: "CREEM_WEBHOOK_SECRET is missing." };
    }

    // Attempt a real API probe against a lightweight read-only endpoint.
    let res: Response;
    try {
      res = await fetch(`${CREEM_API_BASE}/v1/products?limit=1`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      // Network failure — degrade to format/prefix check.
      const hasKnownPrefix = KEY_PREFIXES.some((p) => apiKey.startsWith(p));
      return {
        ok: false,
        detail: `Network error reaching Creem API (${String(err)}). Key format check: ${
          hasKnownPrefix ? "prefix looks valid" : "unrecognised prefix — double-check your key"
        }. CREEM_WEBHOOK_SECRET present.`,
      };
    }

    if (res.ok) {
      return {
        ok: true,
        detail: `Authenticated — GET /v1/products returned ${res.status}. CREEM_WEBHOOK_SECRET present.`,
        scopes: ["products:read"],
      };
    }

    if (res.status === 401 || res.status === 403) {
      let body = "";
      try {
        body = await res.text();
      } catch {
        // ignore
      }
      return {
        ok: false,
        detail:
          `Creem API returned ${res.status} — invalid or revoked key. ${body ? `Response: ${body.slice(0, 200)}` : ""}`.trim(),
      };
    }

    // Unexpected status (404 if endpoint doesn't exist in this API version, etc.) —
    // degrade gracefully to a prefix/format check.
    const hasKnownPrefix = KEY_PREFIXES.some((p) => apiKey.startsWith(p));
    return {
      ok: false,
      // ponytail: honest degradation — no safe GET endpoint confirmed; format check only
      detail:
        `Creem API returned unexpected status ${res.status} on GET /v1/products. ` +
        `Falling back to key-format check: ${
          hasKnownPrefix
            ? "prefix looks valid — key may work despite failed probe"
            : "unrecognised key prefix — verify your key"
        }. CREEM_WEBHOOK_SECRET present.`,
    };
  },
};

export default recipe;
