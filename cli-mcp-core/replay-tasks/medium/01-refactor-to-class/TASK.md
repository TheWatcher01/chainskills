# Task: Refactorer le todo manager en classe

## Instructions

Lis `/tmp/replay-test/todo.ts` et refactore en une classe `TodoManager` :
- Encapsuler l'etat (todos, nextId) en proprietes privees
- Convertir les 5 fonctions en methodes
- Ajouter une methode `clear()` qui vide la liste
- Exporter la classe
- Creer aussi `/tmp/replay-test/todo.test.ts` avec au moins 8 tests

## Criteres de reussite
- Classe TodoManager exportee
- Proprietes privees (pas d'etat global)
- 6 methodes (add, toggle, remove, list, count, clear)
- Fichier test avec 8+ assertions
