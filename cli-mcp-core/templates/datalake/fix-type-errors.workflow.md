---
name: fix-type-errors
description: >
  Detecte et corrige les erreurs TypeScript du datalake. Analyse tsc --noEmit,
  categorise les erreurs, et applique les corrections par batch.
version: 0.1.0
inputs:
  - name: scope
    type: string
    required: false
    default: "."
    description: Scope de verification (chemin relatif ou "." pour tout le projet)
  - name: auto_fix
    type: string
    required: false
    default: "false"
    description: Appliquer les corrections automatiquement (true/false)
outputs:
  - name: errors_found
    type: number
    description: Nombre d'erreurs detectees
  - name: errors_fixed
    type: number
    description: Nombre d'erreurs corrigees
  - name: remaining
    type: string
    description: Erreurs restantes non corrigees
tags: [datalake, typescript, fix, quality]
metadata:
  author: TheWatcher01
  project: datalake-souverain
---

# Step 1 — Detecter les erreurs

@call shell.exec("cd ~/projects/datalake-souverain && pnpm type-check 2>&1") -> $tsc_output

@call shell.exec("echo '$tsc_output' | grep -c 'error TS' || echo '0'") -> $errors_found

# Step 2 — Categoriser les erreurs

@if $errors_found > 0:
  @agent copilot: |
    Analyse ces erreurs TypeScript et categorise-les :

    $tsc_output

    Categories :
    1. TYPE_MISMATCH — types incompatibles
    2. MISSING_PROPERTY — propriete manquante sur un type
    3. IMPORT_ERROR — import manquant ou incorrect
    4. NULL_CHECK — valeur potentiellement null/undefined
    5. UNUSED — variable/import non utilise
    6. OTHER — autre

    Pour chaque erreur, donne :
    - fichier:ligne
    - categorie
    - correction proposee (code exact)
    - niveau de risque (low/medium/high)

    Trie par risque (low first = safe to auto-fix).
    Retourne en JSON.
  @agent -> $categorized

# Step 3 — Appliquer les corrections (si auto_fix)

@if $auto_fix == "true":
  @agent copilot: |
    Applique les corrections de risque LOW uniquement :

    $categorized

    Pour chaque correction LOW :
    1. Lire le fichier
    2. Appliquer le fix exact
    3. Verifier que le fix ne casse pas d'autres types

    Retourne la liste des fichiers modifies.
  @agent -> $fixes_applied

# Step 4 — Re-verifier apres corrections

@if $auto_fix == "true":
  @call shell.exec("cd ~/projects/datalake-souverain && pnpm type-check 2>&1 | tail -10") -> $recheck
  @call shell.exec("echo '$recheck' | grep -c 'error TS' || echo '0'") -> $remaining

# Step 5 — Output

@output $errors_found -> $errors_found
@output $fixes_applied -> $errors_fixed
@output $remaining -> $remaining
