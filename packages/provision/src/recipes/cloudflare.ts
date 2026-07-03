import type { Recipe, ValidateResult, ProvisionCtx } from "../recipe";

const CF_BASE = "https://api.cloudflare.com/client/v4";

const REQUIRED_SCOPES = [
  "Account>Cloudflare Pages:Edit",
  "Account>Workers Scripts:Edit",
  "Account>Workers KV Storage:Edit",
  "Account>Workers R2 Storage:Edit",
  "Zone>DNS:Edit",
  "Account>Account Settings:Read",
];

async function cfGet(
  path: string,
  token: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  try {
    const res = await fetch(`${CF_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: { error: String(err) } };
  }
}

export const recipe: Recipe = {
  id: "cloudflare",
  title: "Cloudflare",
  mode: "guided",
  envVars: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"],
  tokenCreateUrl: "https://dash.cloudflare.com/profile/api-tokens",
  docsUrl: "https://developers.cloudflare.com/fundamentals/api/get-started/create-token/",
  requiredScopes: REQUIRED_SCOPES,
  // API token is root — reused across repos; ACCOUNT_ID is per-repo (derived at provision time)
  rootCredKeys: ["CLOUDFLARE_API_TOKEN"],

  async validate(creds): Promise<ValidateResult> {
    const token = creds["CLOUDFLARE_API_TOKEN"];
    if (!token) {
      return { ok: false, detail: "CLOUDFLARE_API_TOKEN is missing" };
    }

    // 1. Verify the token itself is active
    const verify = await cfGet("/user/tokens/verify", token);
    if (!verify.ok) {
      const status = verify.status;
      const msg =
        status === 401 || status === 403
          ? `${status} invalid or revoked token`
          : status === 0
            ? "network error — could not reach api.cloudflare.com"
            : `unexpected ${status}`;
      return { ok: false, detail: msg };
    }

    const verifyData = verify.body as {
      result?: { status?: string; id?: string };
    };
    if (verifyData?.result?.status !== "active") {
      return {
        ok: false,
        detail: `token status is '${verifyData?.result?.status ?? "unknown"}' (expected 'active')`,
      };
    }

    // 2. Confirm account access + capture account id
    const accounts = await cfGet("/accounts?per_page=50", token);
    if (!accounts.ok) {
      return {
        ok: false,
        detail: `token is active but cannot list accounts (${accounts.status}) — check Account Settings:Read scope`,
      };
    }

    const accountsData = accounts.body as {
      result?: Array<{ id: string; name: string }>;
    };
    const accountList = accountsData?.result ?? [];

    // If the creds also supply CLOUDFLARE_ACCOUNT_ID, confirm it's reachable
    const suppliedAccountId = creds["CLOUDFLARE_ACCOUNT_ID"];
    let matchedAccount = suppliedAccountId
      ? accountList.find((a) => a.id === suppliedAccountId)
      : accountList[0];

    if (suppliedAccountId && !matchedAccount) {
      return {
        ok: false,
        detail: `CLOUDFLARE_ACCOUNT_ID '${suppliedAccountId}' not found in accessible accounts`,
        scopes: [],
        missing: [],
      };
    }

    const accountSummary = matchedAccount
      ? `account '${matchedAccount.name}' (${matchedAccount.id})`
      : `${accountList.length} account(s) accessible`;

    // 3. The CF token API does not expose scope names in the verify response in a
    //    machine-readable way that maps to the human-readable strings above, so we
    //    report "active + accounts readable" as the validated state.
    // ponytail: CF /user/tokens/{id} returns policies with permission group IDs,
    //   not human labels — mapping those UUIDs would require a secondary lookup.
    //   Honest degradation: we confirm token is active and account is reachable.
    return {
      ok: true,
      detail: `authenticated — token active, ${accountSummary}`,
      scopes: ["token:active", "accounts:readable"],
      missing: [],
    };
  },

  async autoProvision(
    creds: Record<string, string>,
    ctx: ProvisionCtx,
  ): Promise<Record<string, string>> {
    const token = creds["CLOUDFLARE_API_TOKEN"];
    if (!token) throw new Error("CLOUDFLARE_API_TOKEN is required");

    // Resolve account id
    let accountId = creds["CLOUDFLARE_ACCOUNT_ID"];
    if (!accountId) {
      ctx.log("Resolving Cloudflare account id…");
      const accounts = await cfGet("/accounts?per_page=1", token);
      if (!accounts.ok) {
        throw new Error(
          `Cannot list accounts (${accounts.status}). Check Account Settings:Read scope.`,
        );
      }
      const data = accounts.body as {
        result?: Array<{ id: string; name: string }>;
      };
      const first = data?.result?.[0];
      if (!first) throw new Error("No Cloudflare accounts found for this token");
      accountId = first.id;
      ctx.log(`Using account '${first.name}' (${accountId})`);
    }

    // Create Pages project
    const projectName = ctx.repoName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 58); // CF Pages project names: max 63 chars, we leave room for suffix

    ctx.log(`Creating Pages project '${projectName}'…`);

    let res: { ok: boolean; status: number; body: unknown };
    try {
      const raw = await fetch(`${CF_BASE}/accounts/${accountId}/pages/projects`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: projectName,
          production_branch: "main",
        }),
      });
      const body = await raw.json();
      res = { ok: raw.ok, status: raw.status, body };
    } catch (err) {
      throw new Error(`Network error creating Pages project: ${String(err)}`);
    }

    if (!res.ok) {
      const errBody = res.body as {
        errors?: Array<{ message: string; code: number }>;
      };
      const cfErrors = errBody?.errors ?? [];
      // Code 8000000 = project already exists — surface a clear message
      const alreadyExists = cfErrors.some((e) => e.code === 8000000);
      if (alreadyExists) {
        ctx.log(`Pages project '${projectName}' already exists — reusing it.`);
      } else {
        const msg = cfErrors.map((e) => e.message).join("; ") || res.status.toString();
        throw new Error(`Failed to create Pages project: ${msg}`);
      }
    } else {
      ctx.log(`Pages project '${projectName}' created.`);
    }

    return {
      CLOUDFLARE_API_TOKEN: token,
      CLOUDFLARE_ACCOUNT_ID: accountId,
      CLOUDFLARE_PAGES_PROJECT_NAME: projectName,
    };
  },
};

export default recipe;
