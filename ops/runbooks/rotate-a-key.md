# Runbook — rotate a key

Rotate a leaked, expired, or routinely-cycled credential (API key, `BETTER_AUTH_SECRET`, DB
password, webhook secret). The stack's secret model is: **local = `.env.local`, team/prod =
Infisical**, and every key is declared in `.env.example`. Ringtail is the tool that mints and
fans keys across both — so rotation is mostly "re-provision that one key."

## 1. Contain (if it leaked)

- Revoke the exposed key **at the provider** first (OpenAI / Creem / GitHub OAuth / …). A key in
  a vault is still burned if it's public.
- If it was committed, it's already flagged — CI runs **gitleaks** on every push
  (`.github/workflows/ci.yml`). Purging history is separate; revoke-and-rotate is what stops the
  bleed.

## 2. Rotate

**Preferred — Ringtail (re-mint + fan out):**

```bash
ops/secrets/bootstrap.sh        # npx ringtail
```

In the cockpit, pick the provider's row and re-run **mint → validate → provision → sync** for the
affected environments. Ringtail writes the new value into `.env.local` (local) and **Infisical**
(dev/staging/prod). You never see the value; the agent never sees it either.

**Manual fallback (no Ringtail):**

1. Generate the new secret (e.g. `openssl rand -base64 32` for `BETTER_AUTH_SECRET`).
2. Update **Infisical** for each environment (source of truth for team/prod).
3. Update your local `.env.local`.
4. Confirm the key exists in `.env.example` (name only, no value) so it stays documented.

## 3. Roll it out

Secrets are read at process start, so running services keep the **old** value until they restart.

- **Local:** restart via `./tilt_down.sh && ./tilt_up.sh` (Tilt re-sources `.env.local`).
- **Prod (k8s):** the value comes from the `stack-secrets` Secret (see
  `infra/k8s/deployment.yaml`). Update it and restart the pods:

  ```bash
  kubectl --context prod create secret generic stack-secrets \
    --from-literal=DATABASE_URL='postgresql://…' --dry-run=client -o yaml | kubectl apply -f -
  kubectl --context prod rollout restart deployment/stack-api
  ```

## 4. Verify

- App boots and the feature that needed the key works (login for `BETTER_AUTH_SECRET`, a paid
  call for `AI_API_KEY`, etc.).
- Old key is **revoked at the provider** (not just replaced).
- No plaintext secret landed in git — `gitleaks detect` is clean.
