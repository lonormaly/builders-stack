# `ops/ci/` — run CI locally

`local-ci.sh` runs the **exact gates** `.github/workflows/ci.yml` runs, in the same order, so you
catch a red build before you push (and before you burn a CI minute).

```bash
ops/ci/local-ci.sh                 # affected vs origin/main
BASE=origin/develop ops/ci/local-ci.sh   # diff against a different base
```

It mirrors the CI `affected` job: frozen install → secret scan (gitleaks) → oxlint → oxfmt
`--check` → `check:seo` → `nx affected -t lint typecheck test build` → dependency scan
(osv-scanner). Tools that only exist as GitHub Actions (gitleaks, osv-scanner) are run **if
installed locally**, otherwise skipped with a note — the code gates (lint/format/typecheck/test/
build/seo) always run. Keep this in lockstep with `ci.yml`: if a step is added there, add it here.
