import type { Recipe, ValidateResult } from "../recipe";

export const recipe: Recipe = {
  id: "infisical",
  title: "Infisical",
  mode: "guided",
  envVars: ["INFISICAL_CLIENT_ID", "INFISICAL_CLIENT_SECRET"],
  tokenCreateUrl: "https://app.infisical.com",
  docsUrl: "https://infisical.com/docs/documentation/platform/identities/universal-auth",
  requiredScopes: [
    "Project → Access Control → Machine Identities → create a machine identity",
    "Assign the identity to the project with the required role (e.g. Member)",
    "Under the identity → Authentication → Universal Auth → add a Client Secret",
  ],
  rootCredKeys: ["INFISICAL_CLIENT_ID", "INFISICAL_CLIENT_SECRET"],

  async validate(creds: Record<string, string>): Promise<ValidateResult> {
    const clientId = creds["INFISICAL_CLIENT_ID"];
    const clientSecret = creds["INFISICAL_CLIENT_SECRET"];

    if (!clientId || !clientSecret) {
      return {
        ok: false,
        detail: "INFISICAL_CLIENT_ID and INFISICAL_CLIENT_SECRET are required",
      };
    }

    let res: Response;
    try {
      res = await fetch("https://app.infisical.com/api/v1/auth/universal-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret }),
      });
    } catch (err) {
      return {
        ok: false,
        detail: `Network error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    if (res.ok) {
      let tokenType = "Bearer";
      try {
        const body = (await res.json()) as { tokenType?: string };
        tokenType = body.tokenType ?? tokenType;
      } catch {
        // ignore parse failure — login still succeeded
      }
      return {
        ok: true,
        detail: `Authenticated — received ${tokenType} access token`,
      };
    }

    // Non-2xx
    let errDetail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) errDetail += `: ${body.message}`;
    } catch {
      // ignore
    }

    return { ok: false, detail: errDetail };
  },
};

export default recipe;
