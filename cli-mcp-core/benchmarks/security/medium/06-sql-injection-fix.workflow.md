---
name: sql-injection-fix
domain: security
difficulty: medium
description: Find and fix SQL injection vulnerabilities
version: "1.0"
outputs:
  - name: vulnerabilities
    type: string
  - name: fixed
    type: string
---

# SQL Injection Fix

## Step 1 — Audit

@agent reviewer
Find ALL SQL injection vulnerabilities in this code:
```javascript
app.get('/users', (req, res) => {
  const sort = req.query.sort || 'name';
  const filter = req.query.filter;
  const page = req.query.page;
  db.query(`SELECT * FROM users WHERE name LIKE '%${filter}%' ORDER BY ${sort} LIMIT 10 OFFSET ${page * 10}`);
});
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.query("SELECT * FROM users WHERE email = '" + email + "' AND password = '" + password + "'");
});
```

@output vulnerabilities = $AGENT_RESULT

## Step 2 — Fix

@agent copilot
Rewrite this code to fix ALL SQL injection vulnerabilities using parameterized queries:
$vulnerabilities

@output fixed = $AGENT_RESULT
