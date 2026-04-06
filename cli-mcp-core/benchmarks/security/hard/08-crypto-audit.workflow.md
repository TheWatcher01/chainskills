---
name: crypto-audit
domain: security
difficulty: hard
description: Audit cryptographic implementation
version: "1.0"
outputs:
  - name: audit
    type: string
  - name: fixes
    type: string
---

# Crypto Audit

## Step 1 — Audit

@agent reviewer
Security audit this encryption module for cryptographic weaknesses:
```typescript
import crypto from 'crypto';
const KEY = Buffer.from('my-secret-key-32chars-long!!!!!');
const IV = Buffer.from('1234567890123456');
function encrypt(text: string): string {
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY, IV);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}
function decrypt(encrypted: string): string {
  const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, IV);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```
Check: IV reuse, key derivation, mode of operation, padding oracle, authentication.

@output audit = $AGENT_RESULT

## Step 2 — Fix

@agent copilot
Rewrite this crypto module fixing all issues found. Use AES-256-GCM with random IV, proper key derivation (PBKDF2 or HKDF), and authenticated encryption:
$audit

@output fixes = $AGENT_RESULT
