---
name: consensus-algorithm
domain: reasoning
difficulty: hard
description: Explain and implement Raft consensus
version: "1.0"
outputs:
  - name: explanation
    type: string
  - name: pseudocode
    type: string
---

# Consensus Algorithm

## Step 1 — Explain

@agent writer
Explain the Raft consensus algorithm in detail:
- Leader election (terms, timeouts, split vote handling)
- Log replication (AppendEntries RPC, commit index)
- Safety guarantees (election restriction, log matching)
- Membership changes (joint consensus)
Compare with Paxos: why is Raft easier to understand?
Use concrete examples with 5 nodes.

@output explanation = $AGENT_RESULT

## Step 2 — Pseudocode

@agent copilot
Write TypeScript pseudocode for a Raft node implementing:
- RequestVote RPC handler
- AppendEntries RPC handler
- Leader election timeout
- Log replication
Use clear types and state machine pattern.

@output pseudocode = $AGENT_RESULT
