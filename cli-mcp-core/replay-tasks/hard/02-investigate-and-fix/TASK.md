# Task: Auditer et corriger le serveur HTTP

## Instructions

Lis `/tmp/replay-test/server.ts` et :
1. Identifie TOUS les problemes (securite, robustesse, bonnes pratiques)
2. Corrige-les tous dans le meme fichier
3. Cree un fichier `/tmp/replay-test/AUDIT.md` listant chaque probleme trouve et sa correction
4. Ajoute le endpoint `GET /users/:id` manquant
5. Ajoute la validation d'input (name et email requis, email valide)

## Criteres de reussite
- AUDIT.md existe avec au moins 5 problemes documentes
- Validation d'input sur POST /users
- Content-Type headers sur toutes les reponses
- UUID au lieu de Math.random()
- GET /users/:id fonctionne
- DELETE retourne 404 si user pas trouve
- try/catch autour du JSON.parse
