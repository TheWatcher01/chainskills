# Task: Corriger les 4 bugs du cache TTL

## Instructions

Lis `/tmp/replay-test/cache.ts` et corrige les 4 bugs :
1. Memory leak : les entrees expirees ne sont jamais nettoyees → ajouter un cleanup periodique ou lazy
2. get() retourne des valeurs expirees → verifier expiresAt
3. size() compte les expirees → ne compter que les valides
4. has() retourne true pour les expirees → verifier expiresAt

Ajoute aussi une methode `cleanup()` qui supprime toutes les entrees expirees.
Cree un test `/tmp/replay-test/cache.test.ts` qui prouve que les bugs sont corriges.

## Criteres de reussite
- get() retourne undefined pour les cles expirees
- has() retourne false pour les cles expirees
- size() ne compte pas les expirees
- cleanup() existe et fonctionne
- Tests prouvant la correction
