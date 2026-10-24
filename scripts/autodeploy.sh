#!/bin/bash
# autodeploy.sh — master is production: deploy it as soon as CI on it is green.
# Same file in Interface-stock, Stock-management-frontend and Tv-Presentation.
# Runs every 5 minutes (cron on htl-server, systemd timer on the Pi); pull-based,
# so nothing has to reach the HTL network from outside.
#
#  1. git fetch; nothing new on master → done.
#  2. CI gate: all GitHub check runs on the new commit finished and none failed
#     (still running → try again next round; no checks at all → fine).
#  3. Fast-forward and deploy: ./deploy.sh if the repo has one, else
#     docker compose up -d --build and wait until every container is healthy.
#  4. Deploy failed → back to the previous commit, deploy that again, and skip
#     the bad commit until master moves on.
#
# Log: .git/autodeploy.log (and journalctl -t autodeploy).
set -uo pipefail
cd "$(dirname "$(readlink -f "$0")")/.." || exit 1
REPO=$(git remote get-url origin | sed -E 's#.*github\.com[:/]##; s#\.git$##')
BAD=.git/autodeploy-bad

log() { echo "$(date '+%F %T') $*" >> .git/autodeploy.log; logger -t autodeploy "$REPO: $*"; }

exec 9> .git/autodeploy.lock
flock -n 9 || exit 0   # previous run (a long build) still busy

git fetch -q origin master || { log "fetch failed"; exit 0; }
old=$(git rev-parse HEAD)
new=$(git rev-parse origin/master)
[ "$old" = "$new" ] && exit 0
[ "$(cat "$BAD" 2>/dev/null)" = "$new" ] && exit 0

ci=$(curl -fsS "https://api.github.com/repos/$REPO/commits/$new/check-runs?per_page=100" | python3 -c '
import json, sys
runs = json.load(sys.stdin)["check_runs"]
if any(r["status"] != "completed" for r in runs): print("pending")
elif any(r["conclusion"] not in ("success", "skipped", "neutral") for r in runs): print("failed")
else: print("ok")') || { log "GitHub API unreachable"; exit 0; }
[ "$ci" = pending ] && exit 0
if [ "$ci" = failed ]; then
    log "CI failed on ${new:0:7}: not deploying"; echo "$new" > "$BAD"; exit 0
fi

compose_deploy() {
    docker compose up -d --build --remove-orphans || return 1
    # Healthy = nothing exited/restarting/unhealthy; containers with a
    # healthcheck get up to 3 minutes to leave "starting". The first wait
    # catches containers that crash right after starting.
    sleep 15
    for _ in $(seq 36); do
        states=$(docker compose ps -a --format '{{.State}} {{.Health}}')
        grep -qE 'exited|dead|restarting|unhealthy' <<< "$states" && return 1
        grep -q starting <<< "$states" || return 0
        sleep 5
    done
    return 1
}
deploy() { if [ -x ./deploy.sh ]; then ./deploy.sh; else compose_deploy; fi; }

if ! git merge -q --ff-only "$new"; then
    log "cannot fast-forward to ${new:0:7} (local changes?): fix by hand"; echo "$new" > "$BAD"; exit 1
fi
if deploy >> .git/autodeploy.log 2>&1; then
    log "deployed ${old:0:7} -> ${new:0:7}"
else
    log "deploy of ${new:0:7} failed: rolling back to ${old:0:7}"
    echo "$new" > "$BAD"
    git reset -q --keep "$old" && deploy >> .git/autodeploy.log 2>&1 \
        && log "rolled back to ${old:0:7}" || log "ROLLBACK FAILED: fix by hand"
    exit 1
fi
