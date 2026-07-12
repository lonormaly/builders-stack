# builders-stack — Tilt entrypoint.  Boot with:  ./tilt_up.sh   (never `tilt up`
# directly — the script pins Tilt UI port 10380 so multiple projects coexist).
#
# Real logic lives in .devops/Tiltfile. Served roles get stable named URLs via
# Vercel Portless: <service>.stack.localhost:1355 — no pinned service ports.
# See docs/portless.md.

load_dynamic('.devops/Tiltfile')

# =============================================================================
# Dashboard "title" — Tilt has no native project-title setting, so a banner
# resource in a digit-prefixed label group (Tilt sorts groups case-insensitively,
# so a leading digit is the only thing that sorts above the alphabet) headlines
# the sidebar with the project name. Cosmetic, zero-cost.
# =============================================================================
local_resource(
    'BUILDERS-STACK',
    cmd='echo "🏗️  Builders Stack — the shared TS-backend template dashboard · ./tilt_up.sh · UI :10380"',
    labels=['0-BUILDERS-STACK'],
)
