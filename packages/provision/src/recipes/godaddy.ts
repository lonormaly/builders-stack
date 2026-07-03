import type { Recipe, ValidateResult, ProvisionCtx } from "../recipe.ts";

const API = "https://api.godaddy.com";

function authHeader(key: string, secret: string): string {
  return `sso-key ${key}:${secret}`;
}

export const recipe: Recipe = {
  id: "godaddy",
  title: "GoDaddy (registrar / DNS)",
  mode: "guided",
  envVars: ["GODADDY_API_KEY", "GODADDY_API_SECRET"],
  rootCredKeys: ["GODADDY_API_KEY", "GODADDY_API_SECRET"],
  tokenCreateUrl: "https://developer.godaddy.com/keys",
  docsUrl: "https://developer.godaddy.com/doc/endpoint/domains",
  requiredScopes: [
    // GoDaddy OTE keys are sandbox-only — user must explicitly create a PRODUCTION key
    "Production key (not OTE/sandbox) with Domains: Read & Write access",
  ],

  async validate(creds): Promise<ValidateResult> {
    const key = creds["GODADDY_API_KEY"] ?? "";
    const secret = creds["GODADDY_API_SECRET"] ?? "";
    if (!key || !secret) {
      return { ok: false, detail: "GODADDY_API_KEY and GODADDY_API_SECRET are both required" };
    }
    let res: Response;
    try {
      res = await fetch(`${API}/v1/domains?limit=1`, {
        headers: { Authorization: authHeader(key, secret) },
      });
    } catch (err) {
      return { ok: false, detail: `Network error: ${String(err)}` };
    }
    if (res.ok) {
      let domains: unknown[] = [];
      try {
        domains = (await res.json()) as unknown[];
      } catch {
        // response body irrelevant
      }
      return {
        ok: true,
        detail: `Authenticated — ${domains.length} domain(s) visible (production key confirmed)`,
        scopes: ["domains:read"],
      };
    }
    if (res.status === 401 || res.status === 403) {
      let body = "";
      try {
        body = await res.text();
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        detail:
          `${res.status} — invalid or OTE/sandbox key. Create a PRODUCTION key at https://developer.godaddy.com/keys. ${body}`.trim(),
      };
    }
    return { ok: false, detail: `Unexpected ${res.status} from GoDaddy API` };
  },

  /**
   * Nameserver swap: updates ctx.domain's NS records to the supplied nameservers.
   * Nameservers are read from creds.CLOUDFLARE_NAMESERVERS (comma-separated),
   * since ProvisionCtx carries no nameserver field.
   */
  async autoProvision(creds, ctx: ProvisionCtx): Promise<Record<string, string>> {
    const key = creds["GODADDY_API_KEY"] ?? "";
    const secret = creds["GODADDY_API_SECRET"] ?? "";
    const domain = ctx.domain ?? creds["GODADDY_DOMAIN"] ?? "";
    const rawNS = creds["CLOUDFLARE_NAMESERVERS"] ?? "";

    if (!domain) {
      throw new Error("autoProvision requires ctx.domain or creds.GODADDY_DOMAIN");
    }
    if (!rawNS) {
      throw new Error(
        "autoProvision requires creds.CLOUDFLARE_NAMESERVERS (comma-separated list of nameservers to install)",
      );
    }

    const nameServers = rawNS
      .split(",")
      .map((ns) => ns.trim())
      .filter(Boolean);

    if (nameServers.length < 2) {
      throw new Error(`Expected at least 2 nameservers, got: ${nameServers.join(", ")}`);
    }

    ctx.log(`Updating nameservers for ${domain} → ${nameServers.join(", ")}`);

    let res: Response;
    try {
      res = await fetch(`${API}/v1/domains/${encodeURIComponent(domain)}`, {
        method: "PATCH",
        headers: {
          Authorization: authHeader(key, secret),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nameServers }),
      });
    } catch (err) {
      throw new Error(`Network error updating nameservers: ${String(err)}`);
    }

    if (!res.ok) {
      let body = "";
      try {
        body = await res.text();
      } catch {
        /* ignore */
      }
      throw new Error(`GoDaddy PATCH /v1/domains/${domain} failed ${res.status}: ${body}`);
    }

    ctx.log(`Nameservers updated successfully for ${domain}`);
    return {
      GODADDY_DOMAIN: domain,
      GODADDY_NAMESERVERS_SET: nameServers.join(","),
    };
  },
};

export default recipe;
