---
name: threat-model
version: 1.0.0
domain: security
difficulty: hard
description: "Create a STRIDE threat model"
---

# Step 1 — System
@call shell.exec(echo "E-commerce platform: React SPA → API Gateway → Auth Service (JWT) → Product Service → Order Service → Payment Service (Stripe) → PostgreSQL. Users: customers, admins. External: Stripe API, email service.") → $system

# Step 2 — Threat model
@agent copilot Create a STRIDE threat model for this system. For each component, identify threats across all 6 STRIDE categories (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege). Rate each threat and propose mitigations: $system → $model

# Step 3 — Output
@output model = $model
