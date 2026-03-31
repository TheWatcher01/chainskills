---
name: add-api-route
description: >
  Ajoute une nouvelle route API Hono au datalake. Copie+adapte un template existant,
  cree les schemas Zod de validation, et teste avec curl.
version: 0.1.0
inputs:
  - name: route_name
    type: string
    required: true
    description: Nom de la route (kebab-case, ex. "formations")
  - name: methods
    type: string
    required: false
    default: "GET"
    description: Methodes HTTP (GET, POST, GET+POST)
  - name: description
    type: string
    required: true
    description: Description fonctionnelle de la route
  - name: template
    type: string
    required: false
    default: "admin"
    description: Route existante a utiliser comme template
outputs:
  - name: route_path
    type: string
    description: Chemin du fichier route cree
  - name: test_result
    type: string
    description: Resultat du test curl
tags: [datalake, api, hono, scaffold]
metadata:
  author: TheWatcher01
  project: datalake-souverain
  reuses:
    - src/api/routes/*.ts
    - src/api/validation.ts
    - src/api/index.ts
---

# Step 1 — Verifier les pre-requis

@call shell.exec("test -f ~/projects/datalake-souverain/src/api/routes/$route_name.ts && echo 'EXISTS' || echo 'OK'") -> $check

@assert $check == "OK" "Route $route_name.ts existe deja"

# Step 2 — Lire le template et le registre

@parallel:

## Lire le template route

@call shell.exec("cat ~/projects/datalake-souverain/src/api/routes/$template.ts") -> $template_code

## Lire le fichier index API (pour le montage)

@call shell.exec("cat ~/projects/datalake-souverain/src/api/index.ts") -> $api_index

## Lire la validation existante

@call shell.exec("cat ~/projects/datalake-souverain/src/api/validation.ts") -> $validation

## Verifier le port API

@call shell.exec("cat ~/projects/api-registry/REGISTRY.md 2>/dev/null | head -50") -> $api_registry

# Step 3 — Generer la route

@agent copilot: |
  Cree une nouvelle route API Hono pour '$route_name'.
  Description: $description
  Methodes: $methods

  TEMPLATE A ADAPTER :
  $template_code

  REGLES :
  1. Header comment avec les endpoints documentes
  2. Utiliser createLogger("$route_name-api")
  3. Validation Zod via validateBody/validateQuery
  4. SQL parametre (getPrisma(), pas d'interpolation)
  5. Pagination cursor-based si GET list
  6. Error handling avec status codes corrects
  7. French comments, English identifiers

  Retourne UNIQUEMENT le code TypeScript.
@agent -> $route_code

# Step 4 — Ecrire et monter la route

@call shell.exec("echo '$route_code' > ~/projects/datalake-souverain/src/api/routes/$route_name.ts") -> $route_path

# Step 5 — Ajouter au montage API

@agent copilot: |
  Modifie le fichier index.ts pour monter la nouvelle route '$route_name'.

  FICHIER ACTUEL :
  $api_index

  AJOUT :
  - import { default as $route_name } from "./routes/$route_name.js"
  - app.route("/api/$route_name", $route_name)

  Retourne le fichier complet modifie.
@agent -> $updated_index

# Step 6 — Type-check

@call shell.exec("cd ~/projects/datalake-souverain && pnpm type-check 2>&1 | tail -10") -> $typecheck

# Step 7 — Test curl

@try:
  @call shell.exec("curl -s http://localhost:3001/api/$route_name | head -50") -> $test_result
@on-error: log and continue

# Step 8 — Output

@output $route_path -> $route_path
@output $test_result -> $test_result
