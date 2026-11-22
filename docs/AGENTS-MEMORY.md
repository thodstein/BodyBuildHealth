# AGENTS memory

## ui

- 2026-11-22 · **ui** — Правка src/ui/screens/TrainingScreen.tsx через edit/write запускает Prettier и раздувает диф (~2000 строк). Точечные изменения применять node-скриптом (fs.readFileSync/writeFileSync с сохранением EOL) и коммитить сразу. (src/ui/screens/TrainingScreen.tsx)
- 2026-11-22 · **ui** — JSX-комментарий {/* */} нельзя вставлять между пропсами компонента (синтаксическая ошибка) — пояснение писать внутри тела стрелочной функции пропа. (src/ui/screens/TrainingScreen.tsx:1068)
- 2026-11-23 · **ui** — Правка src/ui/screens/SRCBBScreen_parts/SessionPlayer.tsx через edit/write вызывает Prettier и даёт диф ~5300+/1770−: точечные изменения делать node-скриптом с сохранением EOL, затем `git add` + `git commit` одной командой. (src/ui/screens/SRCBBScreen_parts/SessionPlayer.tsx)
- 2026-11-23 · **ui** — Тап-таргеты заметок профиля: оверлеи ✕ (вложение) и ⤓ (поделиться фото) держат хитбокс 44×44 — прозрачная кнопка `position:absolute` + визуальный кружок 24/26px во вложенном `<span aria-hidden>`; просто увеличивать картинку нельзя, оверлей съедает половину превью. Гейд: секция 7f в `scripts/check-apk-markers.mjs` (разбирает открывающий тег `<button|input>` с учётом `{}`/кавычек, падает на `minHeight<44` и на `width+height<44`, исключая чекбокс/радио под 44px-`<label>`). (scripts/check-apk-markers.mjs, src/ui/screens/ProfileScreen_v2/ProfileNotesTab.tsx)
- 2026-11-23 · **ui** — Превью фото в заметках 88×88: ⤓ «поделиться» нельзя держать оверлеем — 44px-хитбокс занимает четверть превью и перехватывает тап «открыть фото», уводя его в системный шаринг. Кнопка вынесена под миниатюру (`...btn('ghost'), minHeight: 44`), а бейдж ✕ в редакторе получил `paddingRight: 44`, чтобы визуал 24px не наезжал на имя файла. (src/ui/screens/ProfileScreen_v2/ProfileNotesTab.tsx)

## process

- 2026-11-22 · **process** — OpenCode V2: `ctx.skill.transform` меняет навыки только в рантайме — персистентно навык появляется лишь файлом `.opencode/skills/<id>/SKILL.md` + `ctx.skill.reload()`. (https://opencode.ai/docs/build/plugins/server/)
- 2026-11-23 · **process** — `scripts/check-apk-markers.mjs` не проходит `prettier --check` и не проходил до правок (файл писан в стиле `l => …` с одинарными кавычками). Вставлять туда код только в локальном стиле файла и не гонять `prettier --write` целиком: это переформатирует полтысячи строк. (scripts/check-apk-markers.mjs)
- 2026-11-23 · **process** — В сканере тап-таргетов (`scripts/check-apk-markers.mjs`, секция 7f) нельзя определять «внутри комментария» через `lastIndexOf('/*')` по всему тексту: `accept="audio/*"` во входе загрузки звука делал «закомментированным» весь остаток файла, и гейд молча пропускал всё после него. Работает список диапазонов от литерала `{/*` до `*/}` (`jsxCommentRanges`). Сканер проверяет `minHeight<44`, `height<44` и `width<44` при авто-высоте, понимает `'32px'`, пропускает чекбокс/радио; внутри скрипта есть самопроверка на 13 образцов (включая «кнопка после audio/*»), чтобы правка парсера не отключала гейд тихо. (scripts/check-apk-markers.mjs)


