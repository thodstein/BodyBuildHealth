# AGENTS memory

## ui

- 2026-11-22 · **ui** — Правка src/ui/screens/TrainingScreen.tsx через edit/write запускает Prettier и раздувает диф (~2000 строк). Точечные изменения применять node-скриптом (fs.readFileSync/writeFileSync с сохранением EOL) и коммитить сразу. (src/ui/screens/TrainingScreen.tsx)
- 2026-11-22 · **ui** — JSX-комментарий {/* */} нельзя вставлять между пропсами компонента (синтаксическая ошибка) — пояснение писать внутри тела стрелочной функции пропа. (src/ui/screens/TrainingScreen.tsx:1068)
- 2026-11-23 · **ui** — Правка src/ui/screens/SRCBBScreen_parts/SessionPlayer.tsx через edit/write вызывает Prettier и даёт диф ~5300+/1770−: точечные изменения делать node-скриптом с сохранением EOL, затем `git add` + `git commit` одной командой. (src/ui/screens/SRCBBScreen_parts/SessionPlayer.tsx)

## process

- 2026-11-22 · **process** — OpenCode V2: `ctx.skill.transform` меняет навыки только в рантайме — персистентно навык появляется лишь файлом `.opencode/skills/<id>/SKILL.md` + `ctx.skill.reload()`. (https://opencode.ai/docs/build/plugins/server/)
