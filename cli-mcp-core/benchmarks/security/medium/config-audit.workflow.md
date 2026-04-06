---
name: config-audit
version: 1.0.0
domain: security
difficulty: medium
description: "Audit a server configuration for security"
---

# Step 1 — Config
@call shell.exec(echo "server { listen 80; server_name api.example.com; root /var/www/html; autoindex on; location / { proxy_pass http://localhost:3000; } location /admin { allow all; } }") → $config

# Step 2 — Audit
@agent copilot Audit this nginx configuration for security issues. Check: HTTPS, access controls, information disclosure, headers, and best practices. Provide specific fixes: $config → $audit

# Step 3 — Output
@output audit = $audit
