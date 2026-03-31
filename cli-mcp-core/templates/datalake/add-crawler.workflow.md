---
name: add-crawler
description: >
  Ajoute un nouveau crawler au datalake souverain. Copie+adapte un template existant,
  cree le schema Zod, enregistre la source, et teste en dry-run.
  Pattern: AsyncGenerator + TokenBucket + CircuitBreaker + cursor persistence.
version: 0.1.0
inputs:
  - name: source_name
    type: string
    required: true
    description: Identifiant de la source (kebab-case, ex. "opco-atlas")
  - name: source_type
    type: string
    required: false
    default: "api"
    description: Type de source (api, csv, json, scraping)
  - name: api_url
    type: string
    required: false
    description: URL de base de l'API source
  - name: license
    type: string
    required: false
    default: "etalab-2.0"
    description: Licence de la source (etalab-2.0, ODbL-1.0, custom)
  - name: template
    type: string
    required: false
    default: "sirene"
    description: Crawler existant a utiliser comme template (sirene, ademe, rna, bodacc)
outputs:
  - name: crawler_path
    type: string
    description: Chemin du fichier crawler cree
  - name: test_result
    type: string
    description: Resultat du test dry-run
tags: [datalake, crawler, data-ingestion, scaffold]
metadata:
  author: TheWatcher01
  project: datalake-souverain
  reuses:
    - src/adapters/crawlers/*.crawler.ts
    - src/core/ports/crawler.port.ts
    - src/lib/token-bucket.ts
    - src/lib/circuit-breaker.ts
    - src/lib/retry.ts
---

# Step 1 — Verifier les pre-requis

Verifier que la source n'existe pas deja et que le template est valide.

@call shell.exec("grep -l '$source_name' ~/projects/datalake-souverain/src/config/sources.ts 2>/dev/null || echo 'NOT_FOUND'") -> $existing_source

@assert $existing_source == "NOT_FOUND" "Source $source_name existe deja dans sources.ts"

@call shell.exec("test -f ~/projects/datalake-souverain/src/adapters/crawlers/$template.crawler.ts && echo 'OK' || echo 'MISSING'") -> $template_exists

@assert $template_exists == "OK" "Template $template.crawler.ts introuvable"

# Step 2 — Lire le template et les patterns

Charger le crawler template et les interfaces necessaires.

@parallel:

## Lire le template crawler

@call shell.exec("cat ~/projects/datalake-souverain/src/adapters/crawlers/$template.crawler.ts") -> $template_code

## Lire le port crawler

@call shell.exec("cat ~/projects/datalake-souverain/src/core/ports/crawler.port.ts") -> $crawler_port

## Lire la config sources

@call shell.exec("cat ~/projects/datalake-souverain/src/config/sources.ts") -> $sources_config

# Step 3 — Generer le crawler

Adapter le template au nouveau source. Conserver les patterns obligatoires :
AsyncGenerator, TokenBucket, CircuitBreaker, withRetry, cursor persistence, Zod validation.

@agent copilot: |
  Cree un nouveau crawler TypeScript pour la source '$source_name' (type: $source_type).

  TEMPLATE A ADAPTER (ne pas generer from scratch) :
  $template_code

  INTERFACE PORT :
  $crawler_port

  REGLES OBLIGATOIRES :
  1. Implementer ICrawlerPort<{SourceName}Record>
  2. Utiliser createLogger("$source_name-crawler")
  3. Utiliser TokenBucket pour le rate limiting
  4. Utiliser CircuitBreaker (failureThreshold: 5, resetTimeoutMs: 60000)
  5. Utiliser withRetry (maxRetries: 3, backoff exponentiel)
  6. AsyncGenerator avec yield par batch de 500
  7. Cursor persistence pour resume on interrupt
  8. Validation Zod au point d'entree
  9. SQL parametre (pas d'interpolation)
  10. French comments, English identifiers

  API URL: $api_url
  Licence: $license

  Retourne UNIQUEMENT le code TypeScript, sans markdown.
@agent -> $crawler_code

# Step 4 — Ecrire le fichier crawler

@call shell.exec("echo '$crawler_code' > ~/projects/datalake-souverain/src/adapters/crawlers/$source_name.crawler.ts") -> $write_result

# Step 5 — Enregistrer la source

Ajouter la source dans la config avec rate limit et SLA.

@agent copilot: |
  Ajoute une nouvelle entree dans le fichier sources.ts pour '$source_name'.

  FICHIER ACTUEL :
  $sources_config

  ENTREE A AJOUTER :
  - key: "$source_name"
  - label: titre lisible
  - license: "$license"
  - rateLimit: { requestsPerSecond: 5, burstSize: 10 }
  - sla: { freshnessMaxDays: 7, tier: "Silver" }
  - apiUrl: "$api_url"

  Retourne le fichier complet modifie.
@agent -> $updated_sources

# Step 6 — Tester en dry-run

@try:
  @call shell.exec("cd ~/projects/datalake-souverain && pnpm crawl -- --source $source_name --max 5 --dry-run 2>&1 | tail -20") -> $test_result
@on-error: log and continue

# Step 7 — Type-check

@call shell.exec("cd ~/projects/datalake-souverain && pnpm type-check 2>&1 | tail -10") -> $typecheck

# Step 8 — Output

@output $write_result -> $crawler_path
@output $test_result -> $test_result
