# Replay Tasks — chainskills Agent Benchmark

Taches reproductibles pour comparer les performances de differents modeles
dans Claude Code. Chaque tache a des criteres de reussite verifiables.

## Protocole

1. Lancer Claude Code avec le modele cible (Opus, Sonnet, Haiku)
2. Coller l'instruction de la tache
3. Laisser le modele travailler
4. Executer le script de verification `verify.sh`
5. Importer la session : `chainskills import-session <session.jsonl>`
6. Comparer : `chainskills compare <opus.jsonl> <haiku.jsonl>`

## Structure

```
replay-tasks/
  easy/       — taches simples (lecture, creation de fichier, grep)
  medium/     — taches moderees (refactoring, ajout de feature, tests)
  hard/       — taches complexes (architecture, multi-fichier, debug)
```

Chaque tache contient :
- `TASK.md` — instructions a coller dans Claude Code
- `verify.sh` — script de verification automatique (exit 0 = pass)
- `setup.sh` — preparation de l'environnement (optionnel)
- `golden/` — fichiers attendus pour comparaison (optionnel)
