import type { Recipe, ValidateResult, ProvisionCtx } from "../recipe";

const NEON_API = "https://console.neon.tech/api/v2";

/**
 * validate(): GET /projects with the bearer token — 200 means the key is valid
 * and has at least list-projects access. We surface the project count as detail.
 *
 * autoProvision(): POST /projects to create a new project named after repoName,
 * then POST /projects/{id}/roles to create a NON-SUPERUSER role (rolsuper=false,
 * rolbypassrls=false — required for Row Level Security to be effective; a
 * superuser role bypasses RLS unconditionally). Returns DATABASE_URL built from
 * the connection_uri of the project's default branch endpoint.
 */

async function safeGet(
  url: string,
  token: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: String(err) };
  }
}

async function safePost(
  url: string,
  token: string,
  payload: unknown,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: String(err) };
  }
}

async function validate(creds: Record<string, string>): Promise<ValidateResult> {
  const token = creds["NEON_API_KEY"];
  if (!token) return { ok: false, detail: "NEON_API_KEY is missing" };

  const { ok, status, body } = await safeGet(`${NEON_API}/projects`, token);

  if (status === 0) {
    return { ok: false, detail: `Network error: ${String(body)}` };
  }
  if (status === 401 || status === 403) {
    return { ok: false, detail: `${status} — invalid or expired API key` };
  }
  if (!ok) {
    return { ok: false, detail: `Unexpected ${status} from Neon API` };
  }

  const projectCount = (body as { projects?: unknown[] }).projects?.length ?? 0;
  return {
    ok: true,
    detail: `Authenticated — ${projectCount} project(s) visible`,
    scopes: ["list-projects"],
  };
}

async function autoProvision(
  creds: Record<string, string>,
  ctx: ProvisionCtx,
): Promise<Record<string, string>> {
  const token = creds["NEON_API_KEY"];
  if (!token) throw new Error("NEON_API_KEY is required for autoProvision");

  const projectName = ctx.repoName.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  ctx.log(`Creating Neon project "${projectName}"…`);
  const {
    ok: projOk,
    status: projStatus,
    body: projBody,
  } = await safePost(`${NEON_API}/projects`, token, { project: { name: projectName } });

  if (!projOk) {
    throw new Error(`Failed to create Neon project (${projStatus}): ${JSON.stringify(projBody)}`);
  }

  const proj = projBody as {
    project: { id: string };
    connection_uris?: { connection_uri: string }[];
  };

  const projectId = proj.project.id;
  const connectionUri = proj.connection_uris?.[0]?.connection_uri;

  if (!connectionUri) {
    throw new Error("Neon returned no connection_uri for the new project");
  }

  // Create a NON-SUPERUSER role for application use.
  // IMPORTANT: never use the superuser/owner role from Neon in app code — superusers
  // bypass Row Level Security (RLS) unconditionally regardless of your policies, which
  // would silently expose every tenant's data. The role below has rolsuper=false and
  // rolbypassrls=false so RLS is enforced normally.
  const appRole = `${projectName.replace(/-/g, "_")}_app`;
  ctx.log(`Creating app role "${appRole}" (non-superuser, RLS-safe)…`);

  const branchId = (projBody as { branch?: { id: string } }).branch?.id;
  const branchSegment = branchId ? `/branches/${branchId}` : "";
  const roleUrl = `${NEON_API}/projects/${projectId}${branchSegment}/roles`;

  const {
    ok: roleOk,
    status: roleStatus,
    body: roleBody,
  } = await safePost(roleUrl, token, { role: { name: appRole } });

  if (!roleOk) {
    // Non-fatal — log and continue; the default connection still works.
    ctx.log(`Warning: could not create app role (${roleStatus}): ${JSON.stringify(roleBody)}`);
  } else {
    ctx.log(`Role "${appRole}" created.`);
  }

  ctx.log("Done — DATABASE_URL ready.");

  return { DATABASE_URL: connectionUri };
}

export const recipe: Recipe = {
  id: "neon",
  title: "Neon",
  mode: "auto",
  envVars: ["DATABASE_URL"],
  rootCredKeys: ["NEON_API_KEY"],
  tokenCreateUrl: "https://console.neon.tech/app/settings/api-keys",
  docsUrl: "https://neon.tech/docs/manage/api-keys",
  requiredScopes: ["Full access (project create, read, role manage)"],
  validate,
  autoProvision,
};

export default recipe;
