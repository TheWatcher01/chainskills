# Task: Ajouter un systeme de projections (CQRS pattern)

## Instructions

Le projet dans `/tmp/replay-test/` a un event store basique. Ajoute un systeme de projections :

1. **`/tmp/replay-test/src/core/projection.port.ts`** — interface :
   ```typescript
   interface Projection<T> {
       name: string;
       initialState: T;
       apply(state: T, event: Event): T;
   }
   interface ProjectionStore {
       register<T>(projection: Projection<T>): void;
       rebuild(events: Event[]): void;
       getState<T>(name: string): T | undefined;
   }
   ```

2. **`/tmp/replay-test/src/adapters/memory-projection-store.ts`** — implementation

3. **`/tmp/replay-test/src/cli/project.ts`** — exemple d'utilisation :
   une projection "counter" qui compte les events par type

4. **`/tmp/replay-test/src/core/projection.test.ts`** — 6+ tests

## Contraintes
- Respecter l'architecture hexagonale (core ne depend pas d'adapters)
- Le port est dans core, l'implementation dans adapters
- Types stricts, pas de `any`

## Criteres de reussite
- 4 fichiers crees
- Interface Projection dans core
- Implementation dans adapters
- Pas d'import d'adapter depuis core
- Tests passent
