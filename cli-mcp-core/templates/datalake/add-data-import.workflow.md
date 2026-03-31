---
name: add-data-import
description: >
  Importe un nouveau dataset (CSV/JSON/API) dans le datalake avec provenance complete,
  validation Zod, et enregistrement dans le registre des sources.
version: 0.1.0
inputs:
  - name: source_name
    type: string
    required: true
    description: Identifiant de la source (kebab-case)
  - name: file_path
    type: string
    required: false
    description: Chemin du fichier local (CSV, JSON, JSONL)
  - name: api_url
    type: string
    required: false
    description: URL de l'API source (si pas de fichier local)
  - name: target_table
    type: string
    required: true
    description: Table Prisma cible (ex. Subvention, Entity, EsmsStructure)
  - name: license
    type: string
    required: false
    default: "etalab-2.0"
    description: Licence de la source
  - name: department
    type: string
    required: false
    description: Departement cible (ex. "31", "75")
outputs:
  - name: import_stats
    type: object
    description: Statistiques d'import (inseres, rejetes, doublons)
  - name: quality_report
    type: string
    description: Rapport qualite post-import
tags: [datalake, import, data-ingestion, provenance]
metadata:
  author: TheWatcher01
  project: datalake-souverain
  reuses:
    - src/adapters/import/
    - src/config/data-contracts/
    - src/lib/siren.ts
---

# Step 1 — Valider les entrees

@assert $source_name != "" "source_name requis"
@assert $target_table != "" "target_table requis"

@call shell.exec("node -e \"console.log(crypto.randomUUID())\"") -> $run_id
@call shell.exec("date -Iseconds") -> $started_at

# Step 2 — Verifier la source et la licence

@parallel:

## Verifier que la source n'est pas deja importee

@call shell.exec("cd ~/projects/datalake-souverain && npx prisma db execute --stdin <<< \"SELECT COUNT(*) as cnt FROM \\\"$target_table\\\" WHERE \\\"sourceApi\\\" = '$source_name'\" 2>/dev/null || echo '0'") -> $existing_count

## Verifier le data contract

@call shell.exec("ls ~/projects/datalake-souverain/src/config/data-contracts/$source_name.* 2>/dev/null || echo 'NO_CONTRACT'") -> $contract_check

## Verifier la licence dans le registre

@call shell.exec("grep -c '$source_name' ~/projects/datalake-souverain/src/config/sources.ts 2>/dev/null || echo '0'") -> $source_registered

# Step 3 — Creer le data contract si absent

@if $contract_check == "NO_CONTRACT":
  @agent copilot: |
    Cree un data contract pour la source '$source_name' dans le format du datalake.

    Table cible: $target_table
    Licence: $license

    Le contract doit definir :
    - schema Zod de validation des champs
    - mapping source -> table Prisma
    - champs de provenance obligatoires (source_name, source_updated_at, ingested_at, confidence_score)
    - SLA fraicheur
    - tier qualite (Gold/Silver/Bronze)

    Retourne le code TypeScript du data contract.
  @agent -> $contract_code

# Step 4 — Executer l'import

@if $file_path != "":
  @try:
    @call shell.exec("cd ~/projects/datalake-souverain && pnpm tsx src/adapters/import/generic-import.ts --source $source_name --file '$file_path' --table $target_table --run-id $run_id --dry-run 2>&1 | tail -30") -> $dry_run_result
  @on-error: log and continue

@if $api_url != "":
  @try:
    @call shell.exec("cd ~/projects/datalake-souverain && pnpm crawl -- --source $source_name --max 10 --dry-run 2>&1 | tail -30") -> $dry_run_result
  @on-error: log and continue

# Step 5 — Rapport qualite

@call shell.exec("date -Iseconds") -> $ended_at

@agent copilot: |
  Genere un rapport qualite pour l'import de '$source_name':

  - run_id: $run_id
  - started_at: $started_at
  - ended_at: $ended_at
  - source: $source_name
  - licence: $license
  - table: $target_table
  - dry_run_result: $dry_run_result
  - existing_count: $existing_count

  Evalue les 9 dimensions ISO 8000-8 applicables.
  Retourne un rapport structure JSON.
@agent -> $quality_report

# Step 6 — Output

@output $dry_run_result -> $import_stats
@output $quality_report -> $quality_report
