---
name: msi-recovery
description: Restart Tailscale + Ollama on MSI when offline. Sends Telegram with PowerShell snippet ready to paste.
inputs:
  reason:
    description: Why MSI recovery triggered
    default: "MSI Tailscale offline detected"
agents:
  notifier:
    model: haiku
    skills: []
---

# MSI Recovery — Telegram nudge avec script PS prêt à coller

## Phase 1 — Détecter MSI status

```bash
TS_STATUS=$(tailscale status 2>&1)
MSI_LINE=$(echo "$TS_STATUS" | grep msi)
echo "Current MSI line: $MSI_LINE"

if echo "$MSI_LINE" | grep -q 'offline'; then
    echo "STATUS=offline"
elif echo "$MSI_LINE" | grep -q 'active'; then
    echo "STATUS=active"
    echo "MSI déjà online — recovery non nécessaire."
    exit 0
else
    echo "STATUS=unknown"
fi
```

## Phase 2 — Notifier via Telegram

@notifier construit le message Telegram suivant et le poste sur le bot Albert (chatID = 1741146427) :

```
🔴 MSI down détectée — {{reason}}

Action attendue (2 minutes) :
1. Ouvrir PowerShell ADMIN sur la MSI (clic droit menu démarrer)
2. Coller ce script :

powershell -ExecutionPolicy Bypass -File C:\Users\teddy\projects\albert_agent\scripts\msi-recovery.ps1

3. Vérifier que ça affiche "Recovery completed" en cyan

Pendant ce temps, le datalake bascule automatiquement sur le Ollama VPS (bge-m3 CPU, plus lent mais fonctionnel — 4 jobs déjà transférés).
```

```bash
infisical run --projectId="$INFISICAL_PROJECT_ID" --env=prod -- bash -c "
  curl -s -X POST \"https://api.telegram.org/bot\${TELEGRAM_BOT_TOKEN}/sendMessage\" \
    -d \"chat_id=\${TELEGRAM_CHAT_ID}\" \
    -d \"text=\${MESSAGE}\" \
    -d 'parse_mode=Markdown'
"
```

## Phase 3 — Polling 2 min — wait for MSI back

```bash
echo "Waiting up to 5 min for MSI to come back online..."
for i in $(seq 1 30); do
  if tailscale status | grep -q 'msi.*active' && ! tailscale status | grep -q 'msi.*offline'; then
    echo "✅ MSI back online after $((i*10)) seconds"
    exit 0
  fi
  sleep 10
done
echo "⏰ MSI still offline after 5 min — escalation required"

# Failover datalake auto-deja active via cron, rien à forcer côté ops
exit 1
```

## Phase 4 — Sanity check post-recovery

```bash
# Tester Ollama MSI
if curl -s --max-time 5 http://msi:11434/api/tags > /dev/null; then
    echo "✅ Ollama MSI répond"
else
    echo "🟡 Ollama MSI ne répond pas (Tailscale UP mais Ollama down — script PS aurait dû le restart)"
fi

# Re-pull jobs vps_fallback vers workstation maintenant que MSI revient
docker exec datalake-db psql -U datalake -d datalake -c "
  UPDATE dl_job_queue
  SET \"workerTarget\" = 'workstation', \"updatedAt\"=NOW()
  WHERE status='PENDING' AND \"workerTarget\"='vps_fallback'
    AND \"jobType\" IN ('embed_entities_batch', 'embed_subventions_batch', 'vlm_web_extract');
"
```
