# Data Quality — ISO 8000-8

## Provenance obligatoire

Toute donnee provenant d'une source externe porte ces champs :

```typescript
interface DataProvenance {
  source_name: string;          // "api-sirene-insee"
  source_url: string;           // URL exacte
  source_updated_at: string;    // Date MAJ cote source (ISO 8601)
  ingested_at: string;          // Date entree systeme (ISO 8601)
  confidence_score: number;     // 0.0 a 1.0
  confidence_reason: string;    // "verified_via_cross_ref"
  verification_status: 'raw' | 'normalized' | 'cross_referenced' | 'human_verified';
}
```

Ne jamais confondre `source_updated_at` (date source) et `ingested_at` (date ingestion).

## 9 Dimensions qualite

| # | Dimension | Seuil minimum |
|---|-----------|---------------|
| 1 | Validite | Schema Zod valide >= 99.5% |
| 2 | Exactitude | Cross-ref source officielle |
| 3 | Fiabilite | Tier A/B/C documente |
| 4 | Fraicheur | J+1 (critique), J+7 (standard) |
| 5 | Completude | Champs obligatoires non-null >= 97% |
| 6 | Coherence | 0 anomalies critiques |
| 7 | Unicite | Pas de doublons >= 99.5% |
| 8 | Structure | UTF-8, ISO dates >= 99% |
| 9 | Tracabilite | Provenance complete = 100% (bloquant) |

## Regles absolues

- Donnee sans confidence_score = bug P0
- Pas de fallback silencieux sur donnee manquante
- LLM output valide par schema Zod AVANT persistance
- Pas de regex/JSON.parse sur texte libre LLM
- Probabilites, jamais de garanties
