// The provider-recipe contract. Every provider (cloudflare, neon, better-auth,
// resend, …) ships one `Recipe` in src/recipes/<id>.ts and pushes it onto
// `RECIPES` below. The CLI (src/cli.ts) is provider-agnostic — it only knows
// this interface. Other agents build recipes against THIS file verbatim; treat
// the shapes here as frozen.

/** Result of a real API probe against the entered credentials. */
export type ValidateResult = {
  /** True iff the credentials authenticated AND carry what the repo needs. */
  ok: boolean;
  /** Human-readable outcome ("authenticated as acct 1a2b", "401 invalid token"). */
  detail?: string;
  /** Scopes/permissions the probe observed the token to hold. */
  scopes?: string[];
  /** Required scopes the probe found MISSING (drives the "tick these" retry hint). */
  missing?: string[];
};

/**
 * How a recipe obtains its credentials:
 * - 'auto'     — provider has a management API we can call to create the project/key.
 * - 'guided'   — user creates the key by hand (deep-linked), we validate it.
 * - 'generate' — no external account; we mint the value locally (e.g. an auth secret).
 */
export type Mode = "auto" | "guided" | "generate";

export interface Recipe {
  /** Stable id, also the config-store key for root creds. e.g. 'cloudflare'. */
  id: string;
  /** Display name. e.g. 'Cloudflare'. */
  title: string;
  mode: Mode;
  /** Which .env vars this recipe fills. e.g. ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID']. */
  envVars: string[];
  /** Deep-link to the exact token-creation page (guided mode). */
  tokenCreateUrl?: string;
  /** Docs link shown alongside the prompt. */
  docsUrl?: string;
  /** Human-readable scopes the user must tick when creating the token. */
  requiredScopes?: string[];
  /**
   * Which of this recipe's keys are ROOT creds — stored in ~/.builders-stack and
   * reused across repos (e.g. a Cloudflare API token). Keys NOT listed here are
   * per-repo and live only in that repo's .env.local. Omit for generate-mode
   * recipes whose output is per-repo by nature.
   */
  rootCredKeys?: string[];
  /** REAL API probe — the 10x. Returns whether the creds work + what they can do. */
  validate?(creds: Record<string, string>): Promise<ValidateResult>;
  /** For mode:'generate' — mint the value(s) locally, no network. */
  generate?(): Record<string, string>;
  /** For mode:'auto' — create the project/db/dns and return the resulting env values. */
  autoProvision?(creds: Record<string, string>, ctx: ProvisionCtx): Promise<Record<string, string>>;
}

/** Context handed to `autoProvision` — what to name things + where to log progress. */
export interface ProvisionCtx {
  /** The repo we're provisioning for (project/db naming). */
  repoName: string;
  /** Optional custom domain, for DNS-creating providers. */
  domain?: string;
  /** Progress sink — the CLI wires this to the spinner / --json log stream. */
  log: (m: string) => void;
}

/**
 * The recipe registry. The WIRE PHASE imports each src/recipes/*.ts (which
 * self-registers by pushing here) and the CLI iterates this array. Empty until
 * recipes land — do not add recipes in this file.
 */
export const RECIPES: Recipe[] = [];
