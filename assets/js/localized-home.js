const themeStorageKey = "wayoki-localized-theme";
const newsFeedUrl = "https://script.google.com/macros/s/AKfycbwk3ctmn8qMPDTxkLBoz1K3uSZbN4ICpu70hooE4kGI0TCJtvZt2Rcz4IxNNfhnbn7p/exec";
const newsPreviewLimits = {
    feature: 180,
    card: 120
};

function normalizeTheme(theme) {
    return theme === "dark" ? "dark" : "light";
}

function readStoredTheme() {
    try {
        return normalizeTheme(localStorage.getItem(themeStorageKey));
    } catch (error) {
        return "light";
    }
}

function applyTheme(theme) {
    const nextTheme = normalizeTheme(theme);

    document.documentElement.dataset.theme = nextTheme;
    return nextTheme;
}

function detectLocale() {
    const pathname = window.location.pathname.toLowerCase();

    return pathname === "/ru" || pathname.startsWith("/ru/") ? "ru" : "en";
}

function isArchivePage() {
    const pathname = window.location.pathname.toLowerCase();

    return pathname.endsWith("/news") || pathname.includes("/news/");
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

function renderHomeNews(items, elements, labels) {
    const latestItems = items.slice(0, 3);

    if (!latestItems.length) {
        return;
    }

    const [featuredItem, ...cardItems] = latestItems;

    elements.newsTeaser.textContent = featuredItem.title;
    elements.newsFeature.replaceChildren(buildFeatureNews(featuredItem, labels));
    elements.newsList.replaceChildren(...cardItems.map((item) => buildNewsCard(item, labels)));
}

function renderArchiveNews(items, elements, labels) {
    const archiveItems = items.slice(3);

    if (archiveItems.length && elements.newsEmpty) {
        elements.newsEmpty.hidden = true;
    }

    if (!archiveItems.length) {
        if (elements.newsTeaser) {
            elements.newsTeaser.textContent = labels.archiveTeaser;
        }

        elements.newsList.replaceChildren();
        return;
    }

    if (elements.newsTeaser) {
        elements.newsTeaser.textContent = archiveItems[0].title;
    }

    elements.newsList.replaceChildren(...archiveItems.map((item) => buildNewsCard(item, labels)));
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

applyTheme(readStoredTheme());

document.addEventListener("DOMContentLoaded", () => {
    const themeButtons = document.querySelectorAll("[data-theme-option]");
    const locale = detectLocale();
    const archiveView = isArchivePage();
    const newsStore = new Map();
    const elements = {
        newsFeature: document.querySelector("[data-news-feature]"),
        newsList: document.querySelector("[data-news-list]"),
        newsTeaser: document.querySelector("[data-news-teaser]"),
        newsEmpty: document.querySelector("[data-news-empty]")
    };
    const labels = {
        read: locale === "ru" ? "Открыть заметку" : "Read note",
        expand: locale === "ru" ? "Открыть полностью" : "Open full",
        close: locale === "ru" ? "Закрыть" : "Close",
        archiveTeaser: locale === "ru" ? "Предыдущие заметки и архивные обновления." : "Previous notes and archived updates."
    };

    function syncThemeButtons(theme) {
        themeButtons.forEach((button) => {
            const isActive = button.dataset.themeOption === theme;

            button.setAttribute("aria-pressed", String(isActive));
        });
    }

    function persistTheme(theme) {
        try {
            localStorage.setItem(themeStorageKey, theme);
        } catch (error) {
            return;
        }
    }

    const initialTheme = applyTheme(readStoredTheme());

    syncThemeButtons(initialTheme);

    themeButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const nextTheme = applyTheme(button.dataset.themeOption);

            persistTheme(nextTheme);
            syncThemeButtons(nextTheme);
        });
    });

    if (!elements.newsList) {
        return;
    }

    if (!archiveView && !elements.newsFeature) {
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

    fetchNews(locale)
        .then((items) => {
            newsStore.clear();
            items.forEach((item) => {
                newsStore.set(item.id, item);
            });

            if (archiveView) {
                renderArchiveNews(items, elements, labels);
                return;
            }

            renderHomeNews(items, elements, labels);
        })
        .catch((error) => {
            console.error("Failed to load news feed", error);
        });
});
