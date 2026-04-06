---
taskType: add-feature-safe
category: coding
difficulty: expert
expectedTools: [Read, Edit, Write]
---

# Add CSV Export Support

The data formatter in `src/formatter.ts` currently supports JSON output only.

Add support for CSV format while keeping all existing functionality working.

The `format()` function should accept an optional `outputFormat` parameter (`'json' | 'csv'`), defaulting to `'json'`.
