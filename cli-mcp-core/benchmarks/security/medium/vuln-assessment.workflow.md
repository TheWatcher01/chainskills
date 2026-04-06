---
name: vuln-assessment
version: 1.0.0
domain: security
difficulty: medium
description: "Assess code for OWASP Top 10 vulnerabilities"
---

# Step 1 — Code
@call shell.exec(echo "app.get(\"/user\", (req, res) => { const id = req.query.id; db.query(\"SELECT * FROM users WHERE id = \" + id); }); app.post(\"/login\", (req, res) => { res.cookie(\"session\", token); });") → $code

# Step 2 — Assessment
@agent copilot Assess this code against OWASP Top 10. Identify all vulnerabilities, classify by OWASP category, rate severity, and provide specific fixes with code examples: $code → $assessment

# Step 3 — Output
@output assessment = $assessment
