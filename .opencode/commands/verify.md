---
description: Run the checks this repo requires for the current changes
---

Call the `project_verify` tool (Code Mode: `tools.project.verify({})`) to run exactly the checks the changed
files need. If nothing is dirty, ask which paths to check instead of running everything.

Then:

1. Summarize each step: pass/fail, duration, and the first real error for failures.
2. Fix the cause, not the symptom; re-run `project_verify` until green.
3. Do not commit, amend or push unless explicitly asked.

Extra arguments (optional paths): $ARGUMENTS
