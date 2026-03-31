---
name: cross-ref-source
description: >
  Cross-reference une source de donnees avec les entites existantes du datalake.
  Utilise SIREN comme cle universelle. Calcule les scores de confiance et
  detecte les divergences.
version: 0.1.0
inputs:
  - name: source_name
    type: string
    required: true
    description: Source a cross-referencer (ex. "rna", "bodacc", "cnil-dpo")
  - name: target_source
    type: string
    required: false
    default: "sirene"
    description: Source de reference pour le cross-ref
  - name: department
    type: string
    required: false
    description: Departement pour limiter le scope
  - name: max_records
    type: number
    required: false
    default: 1000
    description: Nombre max d'enregistrements a traiter
outputs:
  - name: matches
    type: object
    description: Resultats du matching (matched, unmatched, discrepancies)
  - name: quality_delta
    type: object
    description: Amelioration du score qualite apres cross-ref
tags: [datalake, cross-reference, data-quality, matching]
metadata:
  author: TheWatcher01
  project: datalake-souverain
  reuses:
    - src/adapters/matching/
    - src/lib/siren.ts
    - src/core/entities/entity.schema.ts
---

# Step 1 — Valider et initialiser

@assert $source_name != "" "source_name requis"

@call shell.exec("node -e \"console.log(crypto.randomUUID())\"") -> $run_id
@call shell.exec("date -Iseconds") -> $started_at

# Step 2 — Extraire les donnees des deux sources

@parallel:

## Extraire la source a cross-referencer

@call shell.exec("cd ~/projects/datalake-souverain && psql -h localhost -p 5434 -U postgres -d datalake -t -c \"SELECT COUNT(*) FROM \\\"Entity\\\" WHERE \\\"sourceApi\\\" = '$source_name'\" 2>/dev/null || echo '0'") -> $source_count

## Extraire la source de reference

@call shell.exec("cd ~/projects/datalake-souverain && psql -h localhost -p 5434 -U postgres -d datalake -t -c \"SELECT COUNT(*) FROM \\\"Entity\\\" WHERE \\\"sourceApi\\\" = '$target_source'\" 2>/dev/null || echo '0'") -> $target_count

# Step 3 — Executer le matching

@try:
  @call shell.exec("cd ~/projects/datalake-souverain && pnpm match -- --source $source_name --target $target_source --department $department --max $max_records --run-id $run_id 2>&1 | tail -30") -> $match_result
@on-error: log and continue

# Step 4 — Analyser les divergences

@agent copilot: |
  Analyse les resultats du cross-referencing :

  Source: $source_name ($source_count enregistrements)
  Reference: $target_source ($target_count enregistrements)
  Resultats matching: $match_result

  Identifie :
  1. MATCHES CONFIRMES — SIREN present dans les deux sources
  2. ORPHELINS SOURCE — SIREN dans $source_name mais pas dans $target_source
  3. DIVERGENCES — meme SIREN, donnees contradictoires (nom, adresse, statut)
  4. ENRICHISSEMENTS — champs complementaires entre les sources

  Pour chaque divergence, propose :
  - Quelle valeur garder (source officielle prioritaire)
  - confidence_score resultant

  Retourne en JSON structure.
@agent -> $analysis

# Step 5 — Calculer le delta qualite

@call shell.exec("date -Iseconds") -> $ended_at

@agent copilot: |
  Calcule l'amelioration qualite apres cross-ref :

  Avant: enregistrements $source_name avec verification_status='raw' ou 'normalized'
  Apres: enregistrements cross-references avec $target_source

  Analyse: $analysis

  Retourne :
  {
    "run_id": "$run_id",
    "source": "$source_name",
    "reference": "$target_source",
    "records_processed": $max_records,
    "confidence_before": 0.50,
    "confidence_after": <calculer>,
    "verification_status_upgrade": "raw -> cross_referenced",
    "lineage": {
      "run_id": "$run_id",
      "job_name": "cross-ref-$source_name-$target_source",
      "started_at": "$started_at",
      "ended_at": "$ended_at"
    }
  }
@agent -> $quality_delta

# Step 6 — Output

@output $analysis -> $matches
@output $quality_delta -> $quality_delta
