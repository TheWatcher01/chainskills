---
name: check-headers
version: 1.0.0
domain: security
difficulty: easy
description: "Audit HTTP security headers"
---

# Step 1 — Headers
@call shell.exec(echo "HTTP/1.1 200 OK\nContent-Type: text/html\nServer: Apache/2.4.41\nX-Powered-By: PHP/7.4") → $headers

# Step 2 — Audit
@agent copilot Audit these HTTP response headers for security issues. Check for: missing security headers (CSP, HSTS, X-Frame-Options, etc.), information disclosure, and recommend fixes: $headers → $audit

# Step 3 — Output
@output audit = $audit
