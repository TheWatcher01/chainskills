---
name: upgrade-fork-zero-casse
description: Mise a jour d'un fork OSS vers la derniere version upstream avec zero perte et zero casse — backups, sync force, rebuild Docker, redeploy, validation
version: 0.1.0
inputs:
  - name: fork
    type: string
    description: Repo fork format owner/repo (ex TheWatcher01/openclaw)
  - name: upstream
    type: string
    description: Repo upstream format owner/repo (ex openclaw/openclaw)
  - name: clone_path
    type: string
    description: Path absolu du clone local
  - name: image_tag
    type: string
    description: Tag Docker principal (ex openclaw:local)
  - name: overlay_dockerfile
    type: string
    description: Path Dockerfile custom optionnel (ex Dockerfile.albert) ou vide
  - name: overlay_image_tag
    type: string
    description: Tag image enrichie optionnelle (ex openclaw-albert:local)
  - name: config_dir
    type: string
    description: Path data app a sauvegarder (ex ~/.openclaw)
  - name: compose_dir
    type: string
    description: Path docker-compose pour redeploy
outputs:
  - name: report
    type: string
    description: Rapport d'execution avec versions avant/apres + sauvegardes
tags:
  - dev
  - ops
  - docker
  - github
  - upgrade

---

# Phase 1 — Audit etat initial

@call shell.exec(gh api repos/$fork --jq '{default_branch, parent: .parent.full_name, fork, pushed_at}') → $fork_meta

@call shell.exec(gh api repos/$fork/commits/main --jq '.sha') → $fork_head

@call shell.exec(gh api repos/$upstream/commits/main --jq '.sha') → $upstream_head

@call shell.exec(gh api 'repos/$fork/compare/$upstream:main...$fork:main' --jq '{ahead_by, behind_by, status, commits: [.commits[]?.sha[0:8]]}') → $diff

@call shell.exec(gh pr list --repo $upstream --author $(echo $fork | cut -d/ -f1) --state all --limit 20) → $pr_history

@call shell.exec(git -C $clone_path status --short && git -C $clone_path log -1 --format='%H %s') → $local_state

# Phase 2 — Sauvegardes (ZERO PERTE)

Date du jour pour suffixage des backups.

@call shell.exec(date +%Y-%m-%d) → $today

## Backup config app

@call shell.exec(tar czf ~/$(basename $config_dir)-backup-$today.tgz -C $(dirname $config_dir) $(basename $config_dir) && ls -lh ~/$(basename $config_dir)-backup-$today.tgz) → $backup_config

## Backup overlay Dockerfile si fourni

@if $overlay_dockerfile != ""
  @call shell.exec(cp $overlay_dockerfile ~/$(basename $overlay_dockerfile).backup-$today) → $backup_dockerfile
@endif

## Tag git etat actuel + branche backup sur fork

@call shell.exec(git -C $clone_path tag pre-sync-$today HEAD || true) → $tag_local

@call shell.exec(gh api -X POST repos/$fork/git/refs -f ref=refs/heads/backup-pre-sync-$today -f sha=$fork_head) → $backup_branch

## Tag image Docker actuelle comme fallback

@call shell.exec(docker tag $image_tag $image_tag-backup-$today 2>&1 && docker images $image_tag --format '{{.ID}}') → $backup_image

@if $overlay_image_tag != ""
  @call shell.exec(docker tag $overlay_image_tag $overlay_image_tag-backup-$today 2>&1) → $backup_overlay_image
@endif

# Phase 3 — Sync fork (action visible)

Force-sync via API GitHub. Les commits "ahead" sont generalement des artefacts d'historique pre-rebase upstream — verifier $diff.commits avant.

@call shell.exec(gh repo sync $fork -b main --force) → $sync_result

@call shell.exec(gh api repos/$fork/commits/main --jq '.sha') → $fork_head_after

# Verifier que fork == upstream
@assert $fork_head_after == $upstream_head

# Phase 4 — Mise a jour du clone local

## Nettoyer untracked, sortir overlay temporairement

@if $overlay_dockerfile != ""
  @call shell.exec(mv $overlay_dockerfile /tmp/$(basename $overlay_dockerfile).staging) → $stash_overlay
@endif

## Reconfigurer remote si refspec restreinte detectee

@call shell.exec(git -C $clone_path config --replace-all remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*' && git -C $clone_path config --add remote.origin.fetch '+refs/tags/*:refs/tags/*') → $refspec_fix

## Ajouter remote fork si absent

@call shell.exec(git -C $clone_path remote add fork https://github.com/$fork.git 2>&1 || echo "(fork remote already exists)") → $add_fork_remote

## Fetch + checkout main

@call shell.exec(git -C $clone_path fetch --all --tags --prune) → $fetch_result

@call shell.exec(git -C $clone_path checkout -B main origin/main && git -C $clone_path log -1 --format='%H %s') → $checkout_result

## Restaurer overlay

@if $overlay_dockerfile != ""
  @call shell.exec(cp /tmp/$(basename $overlay_dockerfile).staging $overlay_dockerfile) → $restore_overlay
@endif

# Phase 5 — Rebuild images Docker

@call shell.exec(docker build -t $image_tag $clone_path 2>&1 | tail -5) → $build_base

@if $overlay_dockerfile != ""
  @call shell.exec(docker build -f $overlay_dockerfile -t $overlay_image_tag $clone_path 2>&1 | tail -5) → $build_overlay
@endif

# Phase 6 — Redeploiement

## Drainer files d'attente avant restart (config_dir-dependant, a adapter)

@call shell.exec(ls -la $config_dir/delivery-queue/ 2>/dev/null || echo "no delivery-queue") → $queue_state

## Restart services

@call shell.exec(cd $compose_dir && docker compose up -d 2>&1 | tail -10) → $compose_up

@call shell.exec(sleep 15 && docker compose -f $compose_dir/docker-compose.yml ps) → $services_status

## Migrations auto (a adapter selon le projet, ici exemple openclaw)

@call shell.exec(docker compose -f $compose_dir/docker-compose.yml exec -T $(docker compose -f $compose_dir/docker-compose.yml config --services | head -1) sh -c 'command -v doctor >/dev/null && doctor --fix' 2>&1 || echo "(no doctor command)") → $migrations

# Phase 7 — Validation

## Healthcheck

@call shell.exec(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18789/healthz 2>&1) → $health_status

## Logs erreurs derniers 200

@call shell.exec(docker compose -f $compose_dir/docker-compose.yml logs --tail=200 2>&1 | grep -iE 'error|fail|exception' | grep -vE 'health|wait' | head -10) → $error_logs

## Plan rollback documente (a executer manuellement si necessaire)

```bash
# Rollback complet :
docker compose -f $compose_dir/docker-compose.yml down
docker tag $image_tag-backup-$today $image_tag
[ -n "$overlay_image_tag" ] && docker tag $overlay_image_tag-backup-$today $overlay_image_tag
tar xzf ~/$(basename $config_dir)-backup-$today.tgz -C $(dirname $config_dir)/
docker compose -f $compose_dir/docker-compose.yml up -d
gh api -X PATCH repos/$fork/git/refs/heads/main -f sha=$fork_head -F force=true
```

# Rapport final

@output report = "Fork $fork mis a jour: $fork_head → $fork_head_after. Image $image_tag rebuild. Healthcheck: $health_status. Sauvegardes: $backup_config, $backup_image, branche backup-pre-sync-$today sur fork."
