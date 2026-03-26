# Collab Site UI

Эта папка отвечает за theme assets и generated registry для сайта.

## Как теперь устроены темы

- `themes/light.css` и `themes/dark.css` — базовые core themes
- `themes.css` — подключает только core theme packs
- `submissions/**/*.json` — source of truth для merged custom themes
- `theme-registry.js` — generated frontend registry, который собирается из merged submission files

## Откуда берутся Custom themes

Custom themes больше не хардкодятся в frontend и не регистрируются вручную.

Источник данных:

`collab/site-ui/submissions/<author-slug>/<theme-slug>.json`

Каждый merged JSON из этой папки:

- валидируется по минимальным полям `themeName`, `authorName`, `tokens`
- превращается в entry внутри `theme-registry.js`
- попадает в dropdown `Custom themes`
- применяется на сайте напрямую из `tokens`

## Что происходит после submit

Submit backend:

1. пишет или обновляет стабильный submission file
2. если находит legacy timestamp submission для той же пары author/theme, мигрирует её в canonical path
3. пересобирает `theme-registry.js` из всех merged submission files + текущего submit
4. открывает PR с обоими изменениями

После merge и deploy:

- merged theme уже есть в `submissions/`
- generated registry уже обновлён
- тема появляется в dropdown без ручного редактирования кода

## Что не нужно делать вручную

Больше не нужно:

- создавать `author-*.css` для custom themes
- добавлять custom theme в `themes.css`
- регистрировать custom theme руками в `theme-registry.js`

## Ограничения

- не меняйте вручную `theme-registry.js`, если тема должна прийти из submissions
- не храните demo themes в runtime registry
- меняйте только safe visual tokens внутри submission payload
