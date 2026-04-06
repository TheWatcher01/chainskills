# Task: Ajouter le support JSON et fichier au Logger

## Instructions

Lis `/tmp/replay-test/logger.ts` et ajoute :
1. Un second parametre optionnel `data?: Record<string, unknown>` a chaque methode de log
2. Un mode JSON : quand `format: 'json'` est passe au constructeur, les logs sortent en JSON
   `{"level":"info","message":"...","data":{...},"timestamp":"..."}`
3. Un mode fichier : quand `output: 'file'` + `filePath: string` est passe, les logs s'ecrivent
   dans le fichier au lieu de console
4. Ne PAS casser l'API existante (retro-compatible)

## Criteres de reussite
- Le constructeur accepte des options etendues
- Les methodes acceptent un `data` optionnel
- Le mode JSON produit du JSON valide
- Le mode fichier ecrit dans un fichier
- L'API existante fonctionne toujours sans changement
