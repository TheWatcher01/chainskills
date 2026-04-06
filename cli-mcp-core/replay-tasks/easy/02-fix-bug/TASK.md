# Task: Corriger les bugs dans calculator.ts

## Instructions

Lis le fichier `/tmp/replay-test/calculator.ts` et corrige TOUS les bugs :
1. `add` fait une soustraction au lieu d'une addition
2. `divide` ne gere pas la division par zero
3. `average` ne gere pas les tableaux vides

Ne change PAS la signature des fonctions. Garde le meme fichier.

## Criteres de reussite
- add(2, 3) === 5
- divide(10, 0) ne crash pas (retourne 0, Infinity, ou throw une erreur propre)
- average([]) ne retourne pas NaN
