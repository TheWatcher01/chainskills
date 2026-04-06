---
name: summarize
version: 1.0.0
domain: writing
difficulty: easy
description: "Summarize a technical text"
---

# Step 1 — Text
@call shell.exec(echo "Kubernetes is an open-source container orchestration platform that automates deployment, scaling, and management of containerized applications. It groups containers into logical units called pods, manages networking between them, handles service discovery, and provides declarative configuration through YAML manifests. Key features include horizontal pod autoscaling, rolling updates, self-healing, and secret management.") → $text

# Step 2 — Summarize
@agent writer Summarize this text in exactly 2 sentences, preserving the key technical concepts: $text → $summary

# Step 3 — Output
@output summary = $summary
