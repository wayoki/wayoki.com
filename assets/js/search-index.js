(function () {
    const supportedLocales = ["ru", "en"];
    const staticEntries = [
        {
            id: "home",
            type: "page",
            featured: true,
            priority: 260,
            target: {
                ru: "/ru/",
                en: "/en/"
            },
            label: {
                ru: "Главная WAYOKI",
                en: "WAYOKI home"
            },
            keywords: {
                ru: ["главная", "домой", "сайт", "wayoki", "старт"],
                en: ["home", "homepage", "site", "wayoki", "start"]
            },
            description: {
                ru: "Главная страница с DevTools для дизайнеров и свежими обновлениями.",
                en: "Homepage with DevTools for designers and the latest updates."
            }
        },
        {
            id: "featured-project",
            type: "project",
            featured: true,
            priority: 240,
            target: {
                ru: "/ru/#game-title",
                en: "/en/#game-title"
            },
            label: {
                ru: "DevTools",
                en: "DevTools"
            },
            keywords: {
                ru: ["devtools", "инструменты", "для дизайнеров", "кастомизация", "кастомные визуалы", "редактор темы"],
                en: ["devtools", "tools", "for designers", "customization", "custom visuals", "theme editor"]
            },
            description: {
                ru: "Инструментарий WAYOKI для редактирования и публикации кастомных визуалов сайта.",
                en: "WAYOKI toolkit for editing and publishing custom site visuals."
            }
        },
        {
            id: "latest-news",
            type: "section",
            featured: true,
            priority: 220,
            target: {
                ru: "/ru/#news",
                en: "/en/#news"
            },
            label: {
                ru: "Последние обновления",
                en: "Recent updates"
            },
            keywords: {
                ru: ["новости", "обновления", "свежие новости", "лента", "заметки"],
                en: ["news", "updates", "recent updates", "feed", "notes"]
            },
            description: {
                ru: "Блок со свежими заметками и объявлениями проекта на главной странице.",
                en: "Homepage section with the newest project notes and announcements."
            }
        },
        {
            id: "news-archive",
            type: "page",
            featured: true,
            priority: 210,
            target: {
                ru: "/ru/news/",
                en: "/en/news/"
            },
            label: {
                ru: "Архив новостей",
                en: "News archive"
            },
            keywords: {
                ru: ["архив", "архив новостей", "предыдущие новости", "старые заметки"],
                en: ["archive", "news archive", "older news", "previous notes"]
            },
            description: {
                ru: "Страница с предыдущими заметками из живой публичной ленты.",
                en: "Page with previous notes pulled from the live public feed."
            }
        },
        {
            id: "telegram-channel",
            type: "channel",
            featured: false,
            priority: 160,
            target: {
                ru: "https://t.me/wayoki",
                en: "https://t.me/wayoki"
            },
            label: {
                ru: "Telegram WAYOKI",
                en: "WAYOKI Telegram"
            },
            keywords: {
                ru: ["телеграм", "telegram", "канал", "заметки", "новости"],
                en: ["telegram", "channel", "notes", "updates", "news"]
            },
            description: {
                ru: "Публичный канал с живыми заметками и обновлениями студии.",
                en: "Public channel with live studio notes and updates."
            }
        }
    ];

    function textValue(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function cloneLocaleRecord(record) {
        if (!record || typeof record !== "object") {
            return {};
        }

        return {
            ru: textValue(record.ru),
            en: textValue(record.en)
        };
    }

    function cloneLocaleArrayRecord(record) {
        if (!record || typeof record !== "object") {
            return {
                ru: [],
                en: []
            };
        }

        return {
            ru: Array.isArray(record.ru) ? record.ru.map(textValue).filter(Boolean) : [],
            en: Array.isArray(record.en) ? record.en.map(textValue).filter(Boolean) : []
        };
    }

    function cloneEntry(entry) {
        return {
            id: textValue(entry.id),
            type: textValue(entry.type),
            featured: Boolean(entry.featured),
            priority: Number(entry.priority) || 0,
            target: cloneLocaleRecord(entry.target),
            label: cloneLocaleRecord(entry.label),
            keywords: cloneLocaleArrayRecord(entry.keywords),
            description: cloneLocaleRecord(entry.description)
        };
    }

    function detectLocale(pathname) {
        const nextPathname = textValue(pathname || window.location.pathname).toLowerCase();

        return nextPathname === "/ru" || nextPathname.startsWith("/ru/") ? "ru" : "en";
    }

    function localizeText(record, locale) {
        const nextLocale = locale === "ru" ? "ru" : "en";
        const fallbackLocale = nextLocale === "ru" ? "en" : "ru";

        if (!record || typeof record !== "object") {
            return "";
        }

        return textValue(record[nextLocale]) || textValue(record[fallbackLocale]);
    }

    function resolveTarget(entry, locale) {
        const nextLocale = locale === "ru" ? "ru" : "en";
        const fallbackLocale = nextLocale === "ru" ? "en" : "ru";

        if (!entry || !entry.target || typeof entry.target !== "object") {
            return "";
        }

        return textValue(entry.target[nextLocale]) || textValue(entry.target[fallbackLocale]);
    }

    function uniqueValues(values) {
        const seen = new Set();

        return values.filter((value) => {
            const nextValue = textValue(value);

            if (!nextValue || seen.has(nextValue)) {
                return false;
            }

            seen.add(nextValue);
            return true;
        });
    }

    function getNewsKey(item, index) {
        const itemId = textValue(item && item.id);
        const itemLink = textValue(item && item.link);
        const itemDate = textValue(item && item.date);

        if (itemId) {
            return itemId;
        }

        if (itemLink) {
            return itemLink;
        }

        if (itemDate) {
            return `${itemDate}-${index}`;
        }

        return `news-${index}`;
    }

    function createNewsEntries(newsByLocale) {
        const mergedEntries = new Map();

        supportedLocales.forEach((locale) => {
            const items = Array.isArray(newsByLocale && newsByLocale[locale]) ? newsByLocale[locale] : [];
            const genericKeywords = locale === "ru"
                ? ["новость", "обновление", "заметка", "архив"]
                : ["news", "update", "note", "archive"];

            items.forEach((item, index) => {
                const key = getNewsKey(item, index);
                const entryId = `news-${key}`;
                const itemTarget = textValue(item && item.link);
                const existingEntry = mergedEntries.get(entryId) || {
                    id: entryId,
                    type: "news",
                    featured: index < 2,
                    priority: 180 - Math.min(index, 40),
                    sortOrder: index,
                    target: {
                        ru: "",
                        en: ""
                    },
                    label: {
                        ru: "",
                        en: ""
                    },
                    keywords: {
                        ru: [],
                        en: []
                    },
                    description: {
                        ru: "",
                        en: ""
                    }
                };

                existingEntry.featured = existingEntry.featured || index < 2;
                existingEntry.priority = Math.max(existingEntry.priority, 180 - Math.min(index, 40));
                existingEntry.sortOrder = Math.min(existingEntry.sortOrder, index);

                if (itemTarget) {
                    existingEntry.target[locale] = itemTarget;
                } else {
                    existingEntry.target.ru = existingEntry.target.ru || "/ru/#news";
                    existingEntry.target.en = existingEntry.target.en || "/en/#news";
                }

                existingEntry.label[locale] = textValue(item && item.title);
                existingEntry.description[locale] = textValue(item && item.text);
                existingEntry.keywords[locale] = uniqueValues(
                    existingEntry.keywords[locale].concat([
                        textValue(item && item.title),
                        textValue(item && item.displayDate),
                        textValue(item && item.date)
                    ], genericKeywords)
                );

                mergedEntries.set(entryId, existingEntry);
            });
        });

        return Array.from(mergedEntries.values())
            .map((entry) => {
                const finalizedEntry = cloneEntry(entry);

                if (!textValue(finalizedEntry.label.ru)) {
                    finalizedEntry.label.ru = finalizedEntry.label.en;
                }

                if (!textValue(finalizedEntry.label.en)) {
                    finalizedEntry.label.en = finalizedEntry.label.ru;
                }

                if (!textValue(finalizedEntry.description.ru)) {
                    finalizedEntry.description.ru = finalizedEntry.description.en;
                }

                if (!textValue(finalizedEntry.description.en)) {
                    finalizedEntry.description.en = finalizedEntry.description.ru;
                }

                if (!textValue(finalizedEntry.target.ru)) {
                    finalizedEntry.target.ru = finalizedEntry.target.en;
                }

                if (!textValue(finalizedEntry.target.en)) {
                    finalizedEntry.target.en = finalizedEntry.target.ru;
                }

                finalizedEntry.priority = Number(entry.priority) || 0;
                finalizedEntry.featured = Boolean(entry.featured);
                finalizedEntry.sortOrder = Number(entry.sortOrder) || 0;

                return finalizedEntry;
            })
            .filter((entry) => textValue(entry.label.ru) || textValue(entry.label.en))
            .sort((leftEntry, rightEntry) => {
                if (leftEntry.sortOrder !== rightEntry.sortOrder) {
                    return leftEntry.sortOrder - rightEntry.sortOrder;
                }

                return rightEntry.priority - leftEntry.priority;
            });
    }

    function buildStaticEntries() {
        return staticEntries.map(cloneEntry);
    }

    window.WayokiSearchIndex = {
        supportedLocales,
        detectLocale,
        localizeText,
        resolveTarget,
        buildStaticEntries,
        createNewsEntries
    };
})();
