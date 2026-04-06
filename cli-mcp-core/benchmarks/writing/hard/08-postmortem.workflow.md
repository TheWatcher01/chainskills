---
name: postmortem
domain: writing
difficulty: hard
description: Write a blameless incident postmortem
version: "1.0"
outputs:
  - name: postmortem
    type: string
---

# Incident Postmortem

## Step 1 — Write

@agent writer
Write a blameless incident postmortem for this scenario:
- Incident: Production database failover caused 47 minutes of downtime
- Trigger: Automated security patch on primary DB triggered unexpected restart
- Impact: 100% of API requests failed, ~12,000 users affected
- Root cause: Connection pool exhaustion during failover, app didn't reconnect
- Detection: PagerDuty alert on 5xx spike after 8 minutes
Follow the Google SRE postmortem format:
Summary, Impact, Timeline, Root Cause, Contributing Factors, Resolution, Action Items (with owners and deadlines), Lessons Learned.

@output postmortem = $AGENT_RESULT
