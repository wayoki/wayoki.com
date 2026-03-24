(function () {
    const newsFeedUrl = "https://script.google.com/macros/s/AKfycbwk3ctmn8qMPDTxkLBoz1K3uSZbN4ICpu70hooE4kGI0TCJtvZt2Rcz4IxNNfhnbn7p/exec";
    const newsCacheStorageKey = "wayoki_news_cache";
    const logPrefix = "[wayoki-news]";
    const pendingNewsRequests = new Map();

    function mark(name) {
        if (!window.performance || typeof window.performance.mark !== "function") {
            return;
        }

        try {
            window.performance.mark(name);
        } catch (error) {
            return;
        }
    }

    function log(label, details) {
        if (!window.console || typeof window.console.log !== "function") {
            return;
        }

        if (typeof details === "undefined") {
            console.log(`${logPrefix} ${label}`);
            return;
        }

        console.log(`${logPrefix} ${label}`, details);
    }

    function textValue(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function isPublished(item) {
        if (!item || typeof item !== "object" || typeof item.published === "undefined") {
            return true;
        }

        return item.published === true || item.published === "TRUE" || item.published === "true" || item.published === 1 || item.published === "1";
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

    function fetchNews(locale) {
        const requestUrl = new URL(newsFeedUrl);

        requestUrl.searchParams.set("lang", locale);

        mark(`wayoki_news_fetch_start_${locale}`);
        log("fetch start", {
            locale,
            url: requestUrl.toString()
        });

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

                const normalizedItems = normalizeNewsItems(items, locale);

                mark(`wayoki_news_fetch_end_${locale}`);
                log("fetch end", {
                    locale,
                    items: normalizedItems.length
                });

                return normalizedItems;
            })
            .catch((error) => {
                mark(`wayoki_news_fetch_error_${locale}`);
                log("fetch error", {
                    locale,
                    message: error && error.message ? error.message : String(error)
                });
                throw error;
            });
    }

    function prefetchNews(locale, options = {}) {
        const forceRefresh = Boolean(options.forceRefresh);
        const reason = textValue(options.reason) || "unspecified";

        mark(`wayoki_news_prefetch_called_${locale}`);
        log("prefetch called", {
            locale,
            forceRefresh,
            reason,
            navigationType: getNavigationType()
        });

        if (pendingNewsRequests.has(locale)) {
            log("prefetch reused promise", {
                locale,
                reason
            });
            return pendingNewsRequests.get(locale);
        }

        if (!forceRefresh) {
            const cachedItems = readCachedNews(locale);

            if (cachedItems !== null) {
                const cachedPromise = Promise.resolve(cachedItems);

                pendingNewsRequests.set(locale, cachedPromise);
                log("prefetch resolved from cache", {
                    locale,
                    items: cachedItems.length,
                    reason
                });
                return cachedPromise;
            }
        }

        const requestPromise = fetchNews(locale).then((items) => {
            writeCachedNews(locale, items);
            return items;
        });

        pendingNewsRequests.set(locale, requestPromise);
        return requestPromise;
    }

    function detectBootstrapLocales() {
        const pathname = window.location.pathname.toLowerCase();

        if (pathname === "/" || pathname === "/index.html") {
            return ["ru", "en"];
        }

        return [pathname === "/ru" || pathname.startsWith("/ru/") ? "ru" : "en"];
    }

    function bootstrapPrefetch() {
        const locales = detectBootstrapLocales();
        const forceRefresh = shouldRefreshNewsOnLoad();

        mark("wayoki_news_bootstrap_start");
        log("bootstrap start", {
            path: window.location.pathname,
            locales,
            forceRefresh
        });

        locales.forEach((locale) => {
            prefetchNews(locale, {
                forceRefresh,
                reason: "early-bootstrap"
            });
        });
    }

    window.WayokiNewsPrefetch = {
        prefetchNews,
        readCachedNews,
        shouldRefreshNewsOnLoad
    };

    bootstrapPrefetch();
})();
