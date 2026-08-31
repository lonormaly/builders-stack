---
name: create-a-worktree
description: Create, inspect, or retire an isolated Builders Stack agent runtime through Worktree Zero. Use whenever parallel work needs another checkout or an old worktree needs cleanup.
---

# Create a Builders Stack worktree

Use the repository adapter. It keeps project policy in Builders Stack while the
generic source and runtime lifecycle comes from the single `wt0` binary.

## Create

1. Preserve every existing change in the current checkout.
2. Confirm `ops/dev/wt0.sh --version` reports the version pinned in
   `.wt0-version` and Bun 1.3.14 is available. The launcher verifies the
   release checksum before caching the binary.
3. From the main checkout, run:

```bash
ops/dev/worktree.sh <namespaced-branch>
```

Use the absolute path it prints. Do not call raw `git worktree`, copy the repo,
copy `node_modules`, or share a complete mutable dependency directory.
The wrapper requires copy-on-write source and attaches the verified Bun
prepared environment before reporting the checkout ready.

## Work and inspect

- Start the stack only through the checkout's normal project command.
- Use `ops/dev/wt0.sh doctor <path>` when storage or dependency sharing is in
  doubt.
- Keep the returned branch and path as the runtime identity for later cleanup.
- Treat Finder and `du` as logical size only. Use the Worktree Zero physical
  receipt when reporting actual disk allocation.

## Remove

After the patch is present in `origin/main`, leave the checkout and run:

```bash
ops/dev/worktree.sh --rm <branch>
```

The adapter refuses dirty source, unknown ignored files, live processes,
unmerged patches, and unpreserved merge commits. Never force past a refusal.
Use `ops/dev/worktree.sh --gc` to evaluate finished managed worktrees; it keeps
anything that fails the same safety checks.
