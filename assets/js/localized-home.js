const themeStorageKey = "wayoki-localized-theme";
const themeRuntime = window.WayokiThemeSwitcher || null;
const newsFeedUrl = "https://script.google.com/macros/s/AKfycbwk3ctmn8qMPDTxkLBoz1K3uSZbN4ICpu70hooE4kGI0TCJtvZt2Rcz4IxNNfhnbn7p/exec";
const newsCacheStorageKey = "wayoki_news_cache";
const newsFallbackUrl = "https://t.me/wayoki";
const newsPreviewLimits = {
    feature: 180,
    card: 120
};
let newsPrefetchPromise = null;
let newsPrefetchLocale = "";
const newsPrefetchRuntime = window.WayokiNewsPrefetch || null;

function markFlowEvent(name, details) {
    if (window.performance && typeof window.performance.mark === "function") {
        try {
            window.performance.mark(name);
        } catch (error) {
            // Keep logging even if the mark API rejects the mark.
        }
    }

    if (window.console && typeof window.console.log === "function") {
        console.log(`[wayoki-flow] ${name}`, details || {});
    }
}

function normalizeTheme(theme) {
    if (themeRuntime && typeof themeRuntime.normalizeTheme === "function") {
        return themeRuntime.normalizeTheme(theme);
    }

    const externalRegistry =
        window.WayokiThemeRegistry &&
        window.WayokiThemeRegistry.themeCatalog &&
        typeof window.WayokiThemeRegistry.themeCatalog === "object"
            ? window.WayokiThemeRegistry.themeCatalog
            : null;

    if (externalRegistry && Object.prototype.hasOwnProperty.call(externalRegistry, theme)) {
        return theme;
    }

    return theme === "dark" ? theme : "light";
}

function readStoredTheme() {
    if (themeRuntime && typeof themeRuntime.readStoredTheme === "function") {
        return themeRuntime.readStoredTheme();
    }

    try {
        return normalizeTheme(localStorage.getItem(themeStorageKey));
    } catch (error) {
        return "light";
    }
}

function applyTheme(theme) {
    const nextTheme = normalizeTheme(theme);

    if (themeRuntime && typeof themeRuntime.applyTheme === "function") {
        return themeRuntime.applyTheme(nextTheme);
    }

    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.setAttribute("data-theme-selection", nextTheme);
    return nextTheme;
}

function selectTheme(theme) {
    if (themeRuntime && typeof themeRuntime.selectTheme === "function") {
        return themeRuntime.selectTheme(theme);
    }

    const nextTheme = applyTheme(theme);

    try {
        localStorage.setItem(themeStorageKey, nextTheme);
    } catch (error) {
        return nextTheme;
    }

    return nextTheme;
}

function getThemeCatalog() {
    if (themeRuntime && themeRuntime.themeCatalog && typeof themeRuntime.themeCatalog === "object") {
        return themeRuntime.themeCatalog;
    }

    return {};
}

function getThemeMeta(theme) {
    if (themeRuntime && typeof themeRuntime.getThemeMeta === "function") {
        return themeRuntime.getThemeMeta(theme) || null;
    }

    return getThemeCatalog()[normalizeTheme(theme)] || null;
}

function getActiveTheme() {
    if (themeRuntime && typeof themeRuntime.readActiveTheme === "function") {
        return themeRuntime.readActiveTheme();
    }

    return normalizeTheme(
        textValue(document.documentElement.getAttribute("data-theme-selection")) || textValue(document.documentElement.dataset.theme)
    );
}

function isAuthorTheme(theme) {
    const themeMeta = getThemeMeta(theme);

    return Boolean(themeMeta && themeMeta.group === "author");
}

function getThemeDisplayLabel(theme) {
    const themeMeta = getThemeMeta(theme);
    const explicitLabel = textValue(themeMeta && themeMeta.label);

    if (explicitLabel) {
        return explicitLabel;
    }

    if (theme === "light") {
        return "Light";
    }

    if (theme === "dark") {
        return "Dark";
    }

    return theme;
}

function getAuthorThemeEntries() {
    return Object.entries(getThemeCatalog()).filter((entry) => {
        const meta = entry[1];

        return meta && meta.group === "author";
    });
}

function detectLocale() {
    const pathname = window.location.pathname.toLowerCase();

    return pathname === "/ru" || pathname.startsWith("/ru/") ? "ru" : "en";
}

function isArchivePage() {
    const pathname = window.location.pathname.toLowerCase();

    return pathname.endsWith("/news") || pathname.includes("/news/");
}

function isCustomizationRoute() {
    const pathname = window.location.pathname.toLowerCase().replace(/\/+$/u, "");

    return pathname === "/ru/customization" || pathname === "/en/customization";
}

function textValue(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeWhitespace(value) {
    return textValue(value).replace(/\s+/g, " ");
}

function isPublished(item) {
    if (!item || typeof item !== "object" || typeof item.published === "undefined") {
        return true;
    }

    return item.published === true || item.published === "TRUE" || item.published === "true" || item.published === 1 || item.published === "1";
}

function truncateText(value, limit) {
    const text = normalizeWhitespace(value);

    if (!text || text.length <= limit) {
        return {
            preview: text,
            truncated: false
        };
    }

    const visibleSlice = text.slice(0, limit + 1);
    const lastSpaceIndex = visibleSlice.lastIndexOf(" ");
    const cutIndex = lastSpaceIndex > 0 ? lastSpaceIndex : limit;

    return {
        preview: text.slice(0, cutIndex).trim().replace(/[.,;:!?-]+$/u, "") + "...",
        truncated: true
    };
}

function formatNewsDate(value, locale) {
    const parts = textValue(value).split("-");

    if (parts.length !== 3) {
        return "";
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    if (!year || !month || !day) {
        return "";
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    const formatter = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
        day: "numeric",
        month: "long",
        timeZone: "UTC"
    });

    return formatter.format(date);
}

function normalizeNewsItems(items, locale) {
    return items
        .filter(isPublished)
        .map((item, index) => ({
            id: textValue(item.id) || `news-${index}`,
            date: textValue(item.date),
            displayDate: formatNewsDate(item.date, locale),
            title: textValue(item.title),
            text: textValue(item.text || item.preview || item.description),
            link: textValue(item.link || item.url)
        }))
        .filter((item) => item.title);
}

function normalizeCachedNewsItems(items, locale) {
    if (!Array.isArray(items)) {
        return null;
    }

    const normalizedItems = items
        .map((item, index) => ({
            id: textValue(item && item.id) || `news-${index}`,
            date: textValue(item && item.date),
            displayDate: textValue(item && item.displayDate) || formatNewsDate(item && item.date, locale),
            title: textValue(item && item.title),
            text: textValue(item && item.text),
            link: textValue(item && item.link)
        }))
        .filter((item) => item.title);

    if (items.length && !normalizedItems.length) {
        return null;
    }

    return normalizedItems;
}

function readNewsCacheMap() {
    try {
        const rawCache = sessionStorage.getItem(newsCacheStorageKey);

        if (!rawCache) {
            return {};
        }

        const parsedCache = JSON.parse(rawCache);

        if (!parsedCache || typeof parsedCache !== "object" || Array.isArray(parsedCache)) {
            return {};
        }

        return parsedCache;
    } catch (error) {
        return {};
    }
}

function readCachedNews(locale) {
    const cacheEntry = readNewsCacheMap()[locale];

    if (!cacheEntry || typeof cacheEntry !== "object") {
        return null;
    }

    return normalizeCachedNewsItems(cacheEntry.items, locale);
}

function writeCachedNews(locale, items) {
    const normalizedItems = normalizeCachedNewsItems(items, locale);

    if (!normalizedItems) {
        return;
    }

    try {
        const cacheMap = readNewsCacheMap();

        cacheMap[locale] = {
            updatedAt: Date.now(),
            items: normalizedItems
        };

        sessionStorage.setItem(newsCacheStorageKey, JSON.stringify(cacheMap));
    } catch (error) {
        return;
    }
}

function getNavigationType() {
    if (window.performance && typeof window.performance.getEntriesByType === "function") {
        const [navigationEntry] = window.performance.getEntriesByType("navigation");

        if (navigationEntry && typeof navigationEntry.type === "string") {
            return navigationEntry.type;
        }
    }

    if (window.performance && window.performance.navigation) {
        return window.performance.navigation.type === 1 ? "reload" : "navigate";
    }

    return "navigate";
}

function shouldRefreshNewsOnLoad() {
    return getNavigationType() === "reload";
}

function createNewsHeading(tagName, className, item) {
    const heading = document.createElement(tagName);

    heading.className = className;

    if (!item.link) {
        heading.textContent = item.title;
        return heading;
    }

    const titleLink = document.createElement("a");

    titleLink.className = "news-title-link";
    titleLink.href = item.link;
    titleLink.target = "_blank";
    titleLink.rel = "noopener noreferrer";
    titleLink.textContent = item.title;

    heading.append(titleLink);
    return heading;
}

function createPreview(className, text) {
    const preview = document.createElement("p");

    preview.className = className;
    preview.textContent = text;

    return preview;
}

function createNewsDate(item, className) {
    if (!item.displayDate) {
        return null;
    }

    const date = document.createElement("time");

    date.className = className;
    date.dateTime = item.date;
    date.textContent = item.displayDate;

    return date;
}

function createExternalLink(link, label) {
    if (!link) {
        return null;
    }

    const anchor = document.createElement("a");

    anchor.className = "news-link";
    anchor.href = link;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = label;

    return anchor;
}

function createExpandButton(item, label) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "news-link news-expand-button";
    button.dataset.newsExpand = item.id;
    button.textContent = label;

    return button;
}

function createActions(item, options) {
    const actions = document.createElement("div");
    let hasActions = false;

    actions.className = "news-actions";

    if (item.link) {
        actions.append(createExternalLink(item.link, options.labels.read));
        hasActions = true;
    }

    if (options.truncated) {
        actions.append(createExpandButton(item, options.labels.expand));
        hasActions = true;
    }

    return hasActions ? actions : null;
}

function buildFeatureNews(item, labels) {
    const fragment = document.createDocumentFragment();
    const truncatedText = truncateText(item.text, newsPreviewLimits.feature);
    const date = createNewsDate(item, "news-date");

    if (date) {
        fragment.append(date);
    }

    fragment.append(createNewsHeading("h3", "news-feature-title", item));

    if (truncatedText.preview) {
        fragment.append(createPreview("news-feature-preview", truncatedText.preview));
    }

    const actions = createActions(item, {
        truncated: truncatedText.truncated,
        labels
    });

    if (actions) {
        fragment.append(actions);
    }

    return fragment;
}

function buildNewsCard(item, labels) {
    const card = document.createElement("li");
    const truncatedText = truncateText(item.text, newsPreviewLimits.card);
    const date = createNewsDate(item, "news-date");

    card.className = "news-item";

    if (date) {
        card.append(date);
    }

    card.append(createNewsHeading("h3", "news-item-title", item));

    if (truncatedText.preview) {
        card.append(createPreview("news-preview", truncatedText.preview));
    }

    const actions = createActions(item, {
        truncated: truncatedText.truncated,
        labels
    });

    if (actions) {
        card.append(actions);
    }

    return card;
}

function ensureNewsModal(labels) {
    const modal = document.createElement("div");
    const dialog = document.createElement("div");
    const closeButton = document.createElement("button");
    const date = document.createElement("time");
    const title = document.createElement("h3");
    const body = document.createElement("p");
    const actions = document.createElement("div");
    let lastActiveElement = null;

    modal.className = "news-modal";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");

    dialog.className = "news-modal-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "news-modal-title");

    closeButton.type = "button";
    closeButton.className = "news-modal-close";
    closeButton.setAttribute("aria-label", labels.close);
    closeButton.textContent = "×";

    date.className = "news-date news-modal-date";
    date.hidden = true;

    title.className = "news-modal-title";
    title.id = "news-modal-title";

    body.className = "news-modal-body";

    actions.className = "news-actions news-modal-actions";

    dialog.append(closeButton, date, title, body, actions);
    modal.append(dialog);
    document.body.append(modal);

    function closeModal() {
        if (modal.hidden) {
            return;
        }

        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("news-modal-open");

        if (lastActiveElement && typeof lastActiveElement.focus === "function") {
            lastActiveElement.focus();
        }
    }

    function openModal(item) {
        if (!item || !item.title || !item.text) {
            return;
        }

        lastActiveElement = document.activeElement;
        date.dateTime = item.date || "";
        date.textContent = item.displayDate || "";
        date.hidden = !item.displayDate;
        title.textContent = item.title;
        body.textContent = item.text;
        actions.replaceChildren();

        if (item.link) {
            actions.append(createExternalLink(item.link, labels.read));
        }

        modal.hidden = false;
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("news-modal-open");

        requestAnimationFrame(() => {
            closeButton.focus();
        });
    }

    closeButton.addEventListener("click", closeModal);
    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });
    dialog.addEventListener("click", (event) => {
        event.stopPropagation();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !modal.hidden) {
            closeModal();
        }
    });

    return {
        open: openModal,
        close: closeModal
    };
}

function hasArchiveNewsDom(elements) {
    return Boolean(elements && elements.newsSection && elements.newsList);
}

function hasHomeNewsDom(elements) {
    return Boolean(hasArchiveNewsDom(elements) && elements.newsFeature);
}

function hasRenderableNewsDom(elements, archiveView) {
    return archiveView ? hasArchiveNewsDom(elements) : hasHomeNewsDom(elements);
}

function renderHomeNews(items, elements, labels) {
    const latestItems = items.slice(0, 3);

    if (!latestItems.length) {
        return;
    }

    const [featuredItem, ...cardItems] = latestItems;

    if (elements.newsTeaser) {
        elements.newsTeaser.textContent = featuredItem.title;
    }

    if (elements.newsFeature) {
        elements.newsFeature.replaceChildren(buildFeatureNews(featuredItem, labels));
    }

    if (elements.newsList) {
        elements.newsList.replaceChildren(...cardItems.map((item) => buildNewsCard(item, labels)));
    }
}

function renderArchiveNews(items, elements, labels) {
    const archiveItems = items.slice(3);

    if (elements.newsEmpty) {
        elements.newsEmpty.hidden = archiveItems.length > 0;
    }

    if (!archiveItems.length) {
        if (elements.newsTeaser) {
            elements.newsTeaser.textContent = labels.archiveTeaser;
        }

        if (elements.newsEmpty) {
            elements.newsEmpty.textContent = labels.archiveEmpty;
        }

        if (elements.newsList) {
            elements.newsList.replaceChildren();
        }

        return;
    }

    if (elements.newsTeaser) {
        elements.newsTeaser.textContent = archiveItems[0].title;
    }

    if (elements.newsList) {
        elements.newsList.replaceChildren(...archiveItems.map((item) => buildNewsCard(item, labels)));
    }
}

function syncNewsStore(items, newsStore) {
    newsStore.clear();
    items.forEach((item) => {
        newsStore.set(item.id, item);
    });
}

function setNewsBusy(elements, busy) {
    if (!elements.newsSection) {
        return;
    }

    if (busy) {
        elements.newsSection.setAttribute("aria-busy", "true");
        return;
    }

    elements.newsSection.removeAttribute("aria-busy");
}

function renderHomeNewsStatus(elements, labels, status) {
    const featureItem = {
        id: status.featureId || "news-status-feature",
        date: "",
        displayDate: "",
        title: status.featureTitle,
        text: status.featurePreview,
        link: textValue(status.featureLink)
    };
    const cardItem = {
        id: status.cardId || "news-status-card",
        date: "",
        displayDate: "",
        title: status.cardTitle,
        text: status.cardPreview,
        link: textValue(status.cardLink)
    };

    if (elements.newsTeaser && status.teaser) {
        elements.newsTeaser.textContent = status.teaser;
    }

    if (elements.newsFeature) {
        elements.newsFeature.replaceChildren(buildFeatureNews(featureItem, labels));
    }

    if (!elements.newsList) {
        return;
    }

    if (!status.cardTitle) {
        elements.newsList.replaceChildren();
        return;
    }

    elements.newsList.replaceChildren(buildNewsCard(cardItem, labels));
}

function renderArchiveNewsStatus(elements, teaser, message) {
    if (elements.newsTeaser && teaser) {
        elements.newsTeaser.textContent = teaser;
    }

    if (elements.newsEmpty) {
        elements.newsEmpty.hidden = false;
        elements.newsEmpty.textContent = message;
    }

    if (elements.newsList) {
        elements.newsList.replaceChildren();
    }
}

function renderNewsSection(items, context) {
    if (!context || !hasRenderableNewsDom(context.elements, context.archiveView)) {
        return;
    }

    const normalizedItems = Array.isArray(items) ? items : [];

    syncNewsStore(normalizedItems, context.newsStore);

    if (context.archiveView) {
        renderArchiveNews(normalizedItems, context.elements, context.labels);
        return;
    }

    if (!normalizedItems.length) {
        renderHomeNewsStatus(context.elements, context.labels, {
            teaser: context.labels.emptyTeaser,
            featureTitle: context.labels.emptyFeatureTitle,
            featurePreview: context.labels.emptyFeaturePreview,
            cardTitle: context.labels.emptyCardTitle,
            cardPreview: context.labels.emptyCardPreview,
            featureLink: newsFallbackUrl,
            cardLink: newsFallbackUrl
        });
        return;
    }

    renderHomeNews(normalizedItems, context.elements, context.labels);
}

function fetchNews(locale) {
    const requestUrl = new URL(newsFeedUrl);

    requestUrl.searchParams.set("lang", locale);

    return fetch(requestUrl.toString(), { cache: "no-store" })
        .then((response) => {
            if (!response.ok) {
                throw new Error("News request failed");
            }

            return response.json();
        })
        .then((items) => {
            if (!Array.isArray(items)) {
                throw new Error("News payload is invalid");
            }

            return normalizeNewsItems(items, locale);
        });
}

function prefetchNews(locale, options = {}) {
    const forceRefresh = Boolean(options.forceRefresh);

    if (newsPrefetchPromise && newsPrefetchLocale === locale) {
        return newsPrefetchPromise;
    }

    if (!forceRefresh) {
        const cachedItems = readCachedNews(locale);

        if (cachedItems !== null) {
            newsPrefetchLocale = locale;
            newsPrefetchPromise = Promise.resolve(cachedItems);
            return newsPrefetchPromise;
        }
    }

    newsPrefetchLocale = locale;
    newsPrefetchPromise = fetchNews(locale).then((items) => {
        writeCachedNews(locale, items);
        return items;
    });

    return newsPrefetchPromise;
}

applyTheme(readStoredTheme());

document.addEventListener("DOMContentLoaded", () => {
    let themeButtons = document.querySelectorAll("[data-theme-option]");
    const themeMenuToggle = document.querySelector("[data-theme-menu-toggle]");
    const themeMenu = document.querySelector("[data-theme-menu]");
    const customThemeToggle = document.querySelector("[data-theme-custom-toggle]");
    const customThemeList = document.querySelector("[data-theme-custom-list]");
    const locale = detectLocale();
    const archiveView = isArchivePage();
    const customizationRoute = isCustomizationRoute();
    const newsStore = new Map();
    const elements = {
        newsSection: document.getElementById("news"),
        newsFeature: document.querySelector("[data-news-feature]"),
        newsList: document.querySelector("[data-news-list]"),
        newsTeaser: document.querySelector("[data-news-teaser]"),
        newsEmpty: document.querySelector("[data-news-empty]")
    };
    const labels = {
        read: locale === "ru" ? "Открыть заметку" : "Read note",
        expand: locale === "ru" ? "Открыть полностью" : "Open full",
        close: locale === "ru" ? "Закрыть" : "Close",
        archiveTeaser: locale === "ru" ? "Предыдущие заметки и архивные обновления." : "Previous notes and archived updates.",
        archiveEmpty: locale === "ru"
            ? "Архивные записи появятся здесь, когда накопится больше новостей."
            : "Older notes will appear here as the archive grows.",
        loadingTeaser: locale === "ru" ? "Загружаем последние заметки в фоне..." : "Loading the latest notes in the background...",
        loadingFeatureTitle: locale === "ru" ? "Подтягиваем свежие новости проекта." : "Pulling the latest project updates.",
        loadingFeaturePreview: locale === "ru"
            ? "Секция новостей уже активна и заполнится сразу, как только завершится текущий фоновый запрос."
            : "The news section is already active and will fill in as soon as the current background request finishes.",
        loadingArchive: locale === "ru"
            ? "Архив загружается в фоне и заполнится сразу, как только завершится текущий запрос."
            : "The archive is loading in the background and will fill in as soon as the current request finishes.",
        loadingCardTitle: locale === "ru" ? "Готовим дополнительные записи." : "Preparing additional entries.",
        loadingCardPreview: locale === "ru"
            ? "Если лента отвечает медленно, этот блок останется аккуратным placeholder до прихода данных."
            : "If the feed responds slowly, this block stays as a tidy placeholder until the data arrives.",
        errorTeaser: locale === "ru" ? "Лента новостей сейчас недоступна." : "The news feed is currently unavailable.",
        errorFeatureTitle: locale === "ru" ? "Не удалось загрузить новости прямо сейчас." : "Couldn't load the news feed right now.",
        errorFeaturePreview: locale === "ru"
            ? "Страница продолжает работать нормально. Попробуйте позже или откройте заметки напрямую в Telegram."
            : "The page is still working normally. Please try again later or open the notes directly on Telegram.",
        errorCardTitle: locale === "ru" ? "Фоновая загрузка не ответила вовремя." : "The background request didn't respond in time.",
        errorCardPreview: locale === "ru"
            ? "Если в этой вкладке уже были сохранённые данные, они используются автоматически. Иначе показываем безопасный fallback."
            : "If this tab already had saved data, it is used automatically. Otherwise a safe fallback is shown.",
        errorArchive: locale === "ru"
            ? "Архив временно недоступен. Если в этой вкладке уже были сохранённые новости, они используются автоматически."
            : "The archive is temporarily unavailable. If this tab already had saved news, it is used automatically.",
        emptyTeaser: locale === "ru" ? "Опубликованные новости появятся здесь." : "Published news will appear here.",
        emptyFeatureTitle: locale === "ru" ? "Пока нет опубликованных новостей." : "There are no published news items yet.",
        emptyFeaturePreview: locale === "ru"
            ? "Как только появится первая публичная заметка, главная страница сразу начнёт показывать её здесь."
            : "As soon as the first public note appears, the homepage will start showing it here.",
        emptyCardTitle: locale === "ru" ? "Архив начнёт заполняться позже." : "The archive will start filling in later.",
        emptyCardPreview: locale === "ru"
            ? "До появления новых записей можно следить за обновлениями через основные каналы проекта."
            : "Until new entries arrive, you can follow updates through the project's main channels."
    };
    const readNewsFromCache = newsPrefetchRuntime ? newsPrefetchRuntime.readCachedNews : readCachedNews;
    const shouldRefreshNews = newsPrefetchRuntime ? newsPrefetchRuntime.shouldRefreshNewsOnLoad : shouldRefreshNewsOnLoad;
    const startNewsPrefetch = newsPrefetchRuntime ? newsPrefetchRuntime.prefetchNews : prefetchNews;

    markFlowEvent("wayoki_main_screen_shown", {
        locale,
        path: window.location.pathname
    });

    function syncThemeButtons(theme) {
        themeButtons.forEach((button) => {
            const isActive = button.dataset.themeOption === theme;

            button.setAttribute("aria-pressed", String(isActive));
        });

        if (customThemeToggle) {
            customThemeToggle.setAttribute("aria-pressed", String(isAuthorTheme(theme)));
        }
    }

    function buildThemeButton(theme, className) {
        const button = document.createElement("button");
        const copy = document.createElement("span");
        const label = document.createElement("span");
        const themeMeta = getThemeMeta(theme);
        const authorName = textValue(themeMeta && themeMeta.authorName);

        button.className = className;
        button.type = "button";
        button.dataset.themeOption = theme;
        button.setAttribute("aria-pressed", "false");
        button.setAttribute("aria-label", authorName ? `${getThemeDisplayLabel(theme)} — ${authorName}` : getThemeDisplayLabel(theme));

        copy.className = "theme-button-copy";
        label.className = "theme-button-label";
        label.textContent = getThemeDisplayLabel(theme);
        copy.append(label);

        if (authorName) {
            const meta = document.createElement("span");

            meta.className = "theme-button-meta";
            meta.textContent = authorName;
            copy.append(meta);
        }

        button.append(copy);

        return button;
    }

    function populateCustomThemeList() {
        if (!customThemeList) {
            return;
        }

        customThemeList.textContent = "";

        getAuthorThemeEntries().forEach(([themeName]) => {
            customThemeList.append(
                buildThemeButton(themeName, "theme-button theme-button-option theme-button-option-custom")
            );
        });

        themeButtons = document.querySelectorAll("[data-theme-option]");
        const activeTheme = getActiveTheme() || readStoredTheme();

        if (customThemeToggle) {
            customThemeToggle.hidden = !customThemeList.children.length;
            customThemeToggle.setAttribute("aria-expanded", String(isAuthorTheme(activeTheme)));
        }

        customThemeList.hidden = !customThemeList.children.length || !isAuthorTheme(activeTheme);
    }

    function setCustomThemeListOpen(nextOpen) {
        if (!customThemeList || !customThemeToggle || customThemeToggle.hidden) {
            return;
        }

        customThemeList.hidden = !nextOpen;
        customThemeToggle.setAttribute("aria-expanded", String(nextOpen));
    }

    function setThemeMenuOpen(nextOpen) {
        if (!themeMenuToggle || !themeMenu) {
            return;
        }

        themeMenu.hidden = !nextOpen;
        themeMenuToggle.setAttribute("aria-expanded", String(nextOpen));

        if (!nextOpen && !isAuthorTheme(getActiveTheme())) {
            setCustomThemeListOpen(false);
        }
    }

    populateCustomThemeList();

    const initialTheme = customizationRoute
        ? getActiveTheme() || readStoredTheme()
        : applyTheme(readStoredTheme());

    const activeTheme = getActiveTheme() || initialTheme;

    syncThemeButtons(activeTheme);
    setCustomThemeListOpen(isAuthorTheme(activeTheme));

    if (themeMenuToggle && themeMenu) {
        setThemeMenuOpen(false);

        themeMenuToggle.addEventListener("click", () => {
            setThemeMenuOpen(themeMenu.hidden);
        });

        document.addEventListener("click", (event) => {
            if (themeMenu.hidden) {
                return;
            }

            if (themeMenuToggle.contains(event.target) || themeMenu.contains(event.target)) {
                return;
            }

            setThemeMenuOpen(false);
        });
    }

    if (customThemeToggle && customThemeList) {
        customThemeToggle.addEventListener("click", () => {
            setCustomThemeListOpen(customThemeList.hidden);
        });
    }

    document.addEventListener("click", (event) => {
        const button = event.target.closest("[data-theme-option]");

        if (!button) {
            return;
        }

        const nextTheme = customizationRoute ? applyTheme(button.dataset.themeOption) : selectTheme(button.dataset.themeOption);

        syncThemeButtons(nextTheme);
        setCustomThemeListOpen(isAuthorTheme(nextTheme));
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && themeMenuToggle && themeMenu && !themeMenu.hidden) {
            setThemeMenuOpen(false);
            themeMenuToggle.focus();
        }
    });

    if (!hasRenderableNewsDom(elements, archiveView)) {
        return;
    }

    const newsModal = ensureNewsModal(labels);

    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-news-expand]");

        if (!trigger) {
            return;
        }

        const item = newsStore.get(trigger.dataset.newsExpand);

        if (!item) {
            return;
        }

        newsModal.open(item);
    });

    const cachedItems = readNewsFromCache(locale);
    const hasCachedNews = cachedItems !== null;
    const shouldRefresh = shouldRefreshNews() || !hasCachedNews;
    const newsPromise = startNewsPrefetch(locale, {
        forceRefresh: shouldRefresh,
        reason: "localized-home-init"
    });
    const renderContext = {
        archiveView,
        elements,
        labels,
        newsStore
    };

    if (hasCachedNews) {
        renderNewsSection(cachedItems, renderContext);
    } else if (archiveView) {
        renderArchiveNewsStatus(elements, labels.loadingTeaser, labels.loadingArchive);
    } else {
        renderHomeNewsStatus(elements, labels, {
            teaser: labels.loadingTeaser,
            featureTitle: labels.loadingFeatureTitle,
            featurePreview: labels.loadingFeaturePreview,
            cardTitle: labels.loadingCardTitle,
            cardPreview: labels.loadingCardPreview
        });
    }

    setNewsBusy(elements, !hasCachedNews || shouldRefresh);

    newsPromise
        .then((items) => {
            renderNewsSection(items, renderContext);
            setNewsBusy(elements, false);
        })
        .catch((error) => {
            setNewsBusy(elements, false);
            console.error("Failed to load news feed", error);

            if (hasCachedNews) {
                return;
            }

            if (archiveView) {
                renderArchiveNewsStatus(elements, labels.errorTeaser, labels.errorArchive);
                return;
            }

            renderHomeNewsStatus(elements, labels, {
                teaser: labels.errorTeaser,
                featureTitle: labels.errorFeatureTitle,
                featurePreview: labels.errorFeaturePreview,
                featureLink: newsFallbackUrl,
                cardTitle: labels.errorCardTitle,
                cardPreview: labels.errorCardPreview,
                cardLink: newsFallbackUrl
            });
        });
});
