#!/usr/bin/env bash
# ops/deploy/install-arc.sh — install self-hosted GitHub Actions runners
# (Actions Runner Controller, the modern gha-runner-scale-set architecture) on a
# Kubernetes cluster. See ops/deploy/k8s/actions-runner.yaml for why this exists
# and the security posture; docs/stack/github-runners.md for day-2 operations.
#
# Two Helm releases, matching GitHub's own two-chart split:
#   1. the CONTROLLER — one per cluster, cluster-scoped, watches for scale-set CRs.
#   2. the SCALE SET — one per runner pool, namespaced. These are the runner pods.
#
# Idempotent: `helm upgrade --install` on both, safe to re-run after a version
# bump here or a values change in ops/deploy/k8s/actions-runner-values.yaml.
#
#   GITHUB_REPO_URL=https://github.com/OWNER/REPO ops/deploy/install-arc.sh
#
# ── FILL THESE IN ────────────────────────────────────────────────────────────
#   GITHUB_REPO_URL  the repository the pool serves. Required, no default.
#   KUBECTL_CONTEXT  kube context. Default: `stack`.
#   the `stack-` names below, if you renamed the namespace in actions-runner.yaml.
set -euo pipefail

context="${KUBECTL_CONTEXT:-stack}"
repo_url="${GITHUB_REPO_URL:-}"
if [ -z "$repo_url" ]; then
  echo "Set GITHUB_REPO_URL to the repository this pool serves, e.g." >&2
  echo "  GITHUB_REPO_URL=https://github.com/OWNER/REPO ops/deploy/install-arc.sh" >&2
  exit 2
fi

# Pin the chart. A floating `latest` on the chart that provisions CI
# infrastructure is a supply-chain hole, and it makes an incident unanswerable.
# Check https://github.com/actions/actions-runner-controller/releases before
# bumping — the 0.14.x line is a stated rewrite of both charts.
arc_version="0.14.0"

controller_namespace="arc-systems"
controller_release="stack-arc-controller"
scale_set_namespace="stack-actions-runners"

# THE RELEASE NAME, THE SCALE SET NAME AND THE `runs-on` LABEL ARE ONE STRING,
# AND THAT IS DELIBERATE.
#
# A gha-runner-scale-set is addressed by its NAME and nothing else — there are no
# custom labels and `self-hosted` is NOT one of them. GitHub's own docs: "You can
# use the installation name as the value of runs-on." A workflow saying
# `runs-on: ["self-hosted","stack-cluster"]` matches NO runner, and a job sent to
# a label with no online runner QUEUES FOR 24 HOURS and is then cancelled —
# `timeout-minutes` cannot catch it, because that timer only counts while a job
# is executing.
#
# The Helm RELEASE name is separately the prefix ARC gives every runner pod it
# creates. Making all three equal means one string to keep in step instead of
# three, and it is the string a human types into `runs-on` — here, the repository
# variable FAST_RUNNER_LABEL that .github/workflows/ci.yml reads.
scale_set_release="stack-cluster"

# WHERE THE CACHES LIVE, ON THE NODE'S OWN DISK. ARC runner pods and their dind
# sidecars are EPHEMERAL: /var/lib/docker and the checkout are destroyed with the
# pod. hostPath keeps the exported BuildKit cache, Bun's package cache, the
# checkout and the seeded Nx answers on the node between runs. If that disk gets
# tight, `rm -rf /var/lib/stack-buildx-cache/*` on the node is always safe — the
# next build refills it.
buildx_cache_host_path="/var/lib/stack-buildx-cache"
ci_cache_host_path="/var/lib/stack-ci-cache"

k() { kubectl --context "$context" "$@"; }

# EXACTLY ONE NODE. The checkout and every cache are node-local hostPath data, so
# a pod scheduled on a second node reads empty directories with the same names
# and silently starts cold. Label the node you mean:
#   kubectl label node <node> stack.io/ci-cache=true
cache_nodes="$(k get nodes -l stack.io/ci-cache=true -o name)"
if [ "$(printf '%s\n' "$cache_nodes" | sed '/^$/d' | wc -l | tr -d ' ')" != "1" ]; then
  echo "Exactly one node must have stack.io/ci-cache=true before installing ARC." >&2
  echo "The runner's checkout and caches are node-local hostPath data." >&2
  exit 1
fi

# The Secret a human must already have created (see actions-runner.yaml). Fail
# fast and say exactly what is missing, rather than letting Helm succeed and the
# listener pod crash-loop on an absent secretKeyRef.
k -n "$scale_set_namespace" get secret stack-runner-github-app >/dev/null 2>&1 || {
  echo "stack-runner-github-app secret is missing in $scale_set_namespace." >&2
  echo "Create it first — see the bottom of ops/deploy/k8s/actions-runner.yaml." >&2
  exit 1
}

# The plain-manifest half: namespace, quota, network policy, service account.
k apply -f "$(dirname "$0")/k8s/actions-runner.yaml"

helm upgrade --install "$controller_release" \
  --namespace "$controller_namespace" --create-namespace \
  --version "$arc_version" \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set-controller \
  --kube-context "$context" \
  --wait --timeout 5m

helm upgrade --install "$scale_set_release" \
  --namespace "$scale_set_namespace" \
  --version "$arc_version" \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
  --kube-context "$context" \
  --set-string githubConfigUrl="$repo_url" \
  --set-string githubConfigSecret=stack-runner-github-app \
  --set-string controllerServiceAccount.namespace="$controller_namespace" \
  --set-string controllerServiceAccount.name="${controller_release}-gha-rs-controller" \
  --set-string runnerScaleSetName="$scale_set_release" \
  `# ONE IDLE RUNNER, NOT ZERO. At minRunners=0 the first job of the day waits` \
  `# for a pod to be created, scheduled and registered before it starts — which` \
  `# is exactly the cold start this setup exists to remove. One idle runner also` \
  `# means a health check can see the pool at all.` \
  --set minRunners=1 \
  `# ONE runner, because its checkout and node_modules persist on hostPath.` \
  `# Two runners must never write the same checkout at once; parallelism happens` \
  `# inside Nx, where tasks have separate declared outputs. The known cost is a` \
  `# 2-4 minute wait on back-to-back pushes. Accepted until it hurts.` \
  --set maxRunners=1 \
  --set-string containerMode.type=dind \
  `# THE WHOLE POD SPEC LIVES IN A FILE. containerMode: dind does not MERGE a` \
  `# partial template.spec — supply containers and yours replaces the chart's` \
  `# outright, image and init containers included. Two installs failed learning` \
  `# that; the file carries the receipts.` \
  -f "$(dirname "$0")/k8s/actions-runner-values.yaml" \
  --wait --timeout 5m

echo "ARC controller (v$arc_version) and the $scale_set_release scale set are installed."
echo
echo "Verify, in this order:"
echo "  1. kubectl --context $context -n $scale_set_namespace get pods"
echo "     minRunners=1, so ONE runner pod (plus its dind sidecar) should be Running while idle."
echo "  2. gh api /repos/<owner>/<repo>/actions/runners --jq '.runners[] | {name, status}'"
echo "     Expect at least one runner with \"status\": \"online\"."
echo "  3. Point CI at the pool:"
echo "       gh variable set FAST_RUNNER_LABEL --body '$scale_set_release'"
echo "     Unset it during a cluster incident and CI falls straight back to ubuntu-latest."
echo "  4. kubectl --context $context -n $scale_set_namespace get pod -l app.kubernetes.io/component=runner -o yaml | grep -A2 -E 'buildx-cache|ci-cache'"
echo "     The caches must be backed by $buildx_cache_host_path and $ci_cache_host_path,"
echo "     and init-runner-caches must own both as uid 1001, or every job starts cold."
echo "     The pod must run on $cache_nodes; moving it silently discards the warm cache."
