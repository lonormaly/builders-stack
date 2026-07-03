// Recipe barrel — the single registration point.
//
// Each provider lands as src/recipes/<id>.ts exporting a `recipe: Recipe`. This
// barrel imports each one and pushes it onto the shared RECIPES registry. The CLI
// imports `./recipes` once (see cli.ts) so this module executes and RECIPES fills.
//
// ORDER (matches how the CLI walks a repo): auto-provisioning providers first
// (they can create the cloud resource for you), then guided (you paste a key we
// validate), then generate (minted locally, no account). Within a tier, keep it
// roughly alphabetical.
//
// Adding a provider: import its `recipe` below and add it to the correct tier of
// the RECIPES.push([...]) call. Do not put recipe logic here — registration only.

import { RECIPES } from "../recipe";

// auto — has a management API we can call to create the project/db/dns.
import { recipe as neon } from "./neon";

// guided — you create the key by hand (deep-linked), we validate it.
import { recipe as cloudflare } from "./cloudflare";
import { recipe as creem } from "./creem";
import { recipe as godaddy } from "./godaddy";
import { recipe as infisical } from "./infisical";
import { recipe as posthog } from "./posthog";
import { recipe as resend } from "./resend";

// generate — no external account; minted locally.
import { recipe as betterAuth } from "./better-auth";

RECIPES.push(
  // auto
  neon,
  // guided
  cloudflare,
  creem,
  godaddy,
  infisical,
  posthog,
  resend,
  // generate
  betterAuth,
);

export { RECIPES };
