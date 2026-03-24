# Collab Site UI

Эта папка предназначена для безопасного редактирования визуального слоя тем без вмешательства в core-архитектуру сайта.

## Что здесь можно редактировать

- `themes/*.css` — theme packs: `light`, `dark`, `author-*`
- `themes/_template.css` — шаблон для новой темы
- `themes.css` — список подключённых theme packs
- `theme-registry.js` — доступные темы и текст `by: ...`

## За что отвечает каждый файл

- `themes/light.css` и `themes/dark.css` — базовые визуальные пресеты сайта
- `themes/author-1.css`, `themes/author-2.css` — авторские пресеты
- `themes.css` — какие theme packs реально подключаются
- `theme-registry.js` — какие темы знает переключатель и какой credit показывать

## Как создать новую author theme

1. Скопируйте `themes/_template.css` в новый файл, например `themes/author-3.css`.
2. Поменяйте селектор на `html[data-theme="author-3"]`.
3. Меняйте только токены темы: цвета, поверхности, тени, credit-токены.
4. Добавьте новый файл в `themes.css`.
5. Зарегистрируйте тему в `theme-registry.js`.

## Где менять `by: ...`

Меняйте поле `credit` у нужной темы в `theme-registry.js`.

Пример:

```js
"author-2": {
    group: "author",
    credit: "by author"
}
```

## Что нельзя трогать

- `assets/css/base.css`
- `assets/css/localized.css`
- `assets/css/landing.css`
- `assets/css/theme.css`
- `assets/css/theme-tokens.css`
- `assets/js/theme-switcher.js`
- `assets/js/localized-home.js`
- `assets/js/landing.js`

Эти файлы относятся к core layer: layout, intro flow, app logic, responsive behavior и общей структуре интерфейса.

## Ограничения для theme pack

- Не добавляйте layout-правила, сетки, брейкпоинты и анимационную логику.
- Не меняйте DOM-структуру через CSS-предположения.
- Меняйте только theme tokens и безопасные визуальные значения.

## Как быстро проверить тему

1. Откройте сайт и переключите `light / dark / author-*`.
2. Проверьте header, news bar, cards, feature block и theme menu.
3. Убедитесь, что текст читается, borders видны, а активные состояния не исчезли.
4. Если новая тема должна появиться в меню, предупредите core-owner: кнопки выбора темы живут вне collab-зоны.
