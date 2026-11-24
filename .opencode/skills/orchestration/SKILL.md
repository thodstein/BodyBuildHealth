---
name: Orchestration
description: Workstream orchestration — decompose, fan out to parallel subagents, drive checks until green
---

# Orchestration playbook

The `lead` agent (`.opencode/agents/lead.md`) runs this loop. Use this skill when a task is big enough to need
more than one agent, or when a task must be finished without the user babysitting it.

## 1. Turn a request into acceptance criteria

Write criteria that a command can prove, not adjectives:

| Bad                    | Good                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| «починить планировщик» | `npm run test:bb -- planner` green; план на 12 недель строится без NaN; `type-check` green |
| «ускорить экран»       | рендер CardioHub < 200 мс на 4× CPU throttle; `npm run test:ui` green                      |
| «добавить продукт»     | продукт в `FOOD_DB`, `nutrition-usda-top100` green, макросы сходятся по `4/9/4`            |

If a criterion cannot be verified automatically, say how it will be checked by hand.

## 1a. Triage the task before planning

Classify it on three axes, in one line each; the class decides the sources of truth and the checks:

| Axis         | Values                                                                                                     | What it changes                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Work         | code · data/content · medicine/pharma · research · release · infra                                         | skill to load, which checks can prove it             |
| Truth source | code (`read`/`grep`) · `repo_pharma`/`repo_lab`/`repo_doc` · `evidence_*` · `websearch` · `context7` · MCP | where a number or fact may come from                 |
| Risk         | breaks data/build · changes behaviour · text only                                                          | ordering, review depth, whether a worktree is needed |

Facts first: dose, t½, lab threshold, supplement effect, API behaviour → get the source _before_ the edit. No source
means the answer is "no data", never a plausible number. If research is needed but does not touch code, it is its own
workstream (`explore` with the `research` skill) whose report the lead quotes.

Which tool answers which question is the table in `.opencode/skills/research/SKILL.md` §1; do not guess and do not
substitute memory for a lookup.

## 2. Partition before spawning

- One workstream = one directory or a named set of files. Write the assignment down before dispatching.
- **Never** give the same file to two agents. Shared files (types, `bb-types.ts`, `types.ts`, `AGENTS.md`) are the
  lead's own work, applied at fan-in.
- Reco first (`explore`) when the change spans unfamiliar code; a wrong partition costs more than the recon.
- Serial work (migrations, one engine function, anything with ordering) stays with the lead.

## 3. Dispatch in parallel

Issue all independent `subagent` calls **in the same turn** — they run as background child sessions and the lead is
notified as each one finishes.

Prompt shape that works:

```text
Goal: <one sentence>.
Files you may touch: <exact list>.
Do not touch: <shared files, other areas>.
Follow: <skill id>.
Check: <exact command>.
Report: files changed, command output, leftovers. Do not commit.
```

Rules of thumb:

- `explore` — recon, medium/thorough; ask for a map with paths, no edits.
- `worker` — implementation; one per workstream; edit scoped by the prompt.
- `verifier` — after integration; read-only, runs the commands, reports PASS/FAIL with evidence.
- `reviewer` — after the diff compiles; read-only risk pass (P0–P3 with `file:line`).
- Children cannot spawn children (nesting depth is 1); the lead must do the second level itself.

## 4. Fan-in loop

1. Collect every report; check that nothing outside the assigned files changed (`git status`).
2. Run `project_verify` yourself — a child's green check is not the project's green check.
3. On failure: fix directly or dispatch one focused `worker`; re-run. Repeat until green.
4. Cap at 5 fix rounds per failing check; then report the exact failure instead of looping.

## 5. Stop conditions

Stop and write the report when: all criteria are green; or a genuine fork needs the user (product decision,
destructive action, credentials); or the 5-round cap is hit. Never stop with "in progress" and no next action.

## Parallel sessions for big, conflicting work

When two workstreams must touch overlapping areas, isolate them instead of serialising: the `opencode` Code Mode
namespace has `worktree_create` / `worktree_list` / `worktree_remove`, and `opencode.session_move` can move a session
into a worktree. Merge results yourself; the lead remains the only one who commits.

## Cost and latency

- Subagents start with fresh context: give them context, not history.
- Keep the agent count proportional to the work: 2–4 workstreams is usually the point of diminishing returns.
- Pin models per agent when useful (`model: provider/model#variant` in frontmatter): cheap/fast for `explore`,
  strongest for `lead` and `reviewer`.
- A background child that reports nothing useful twice should be stopped by narrowing the task, not retried verbatim.
