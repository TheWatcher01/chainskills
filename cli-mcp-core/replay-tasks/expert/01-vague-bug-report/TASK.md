# Task: Fix the intermittent API error

The API returns 500 errors on approximately 3% of GET /users/:id requests.
No stack trace available. The error seems random and doesn't correlate with
specific user IDs.

The codebase is in /tmp/replay-test/src/. Figure out what's wrong and fix it.
