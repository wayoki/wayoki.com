(function () {
    const searchIndexRuntime = window.WayokiSearchIndex || null;
    const newsPrefetchRuntime = window.WayokiNewsPrefetch || null;
    const visibleResultCount = 2;
    const uiText = {
        ru: {
            ariaLabel: "Быстрый поиск и переход",
            placeholder: "Быстрый переход: проект, новости, архив",
            empty: "Ничего не найдено. Попробуйте ключевые слова на русском или английском.",
            count(count) {
                return `${count} совпадения`;
            },
            types: {
                page: "Страница",
                project: "Проект",
                section: "Раздел",
                news: "Новость",
                channel: "Канал"
            }
        },
        en: {
            ariaLabel: "Quick search and jump",
            placeholder: "Quick jump: project, news, archive",
            empty: "No results yet. Try keywords in English or Russian.",
            count(count) {
                return `${count} matches`;
            },
            types: {
                page: "Page",
                project: "Project",
                section: "Section",
                news: "News",
                channel: "Channel"
            }
        }
    };

    function textValue(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeWhitespace(value) {
        return textValue(value).replace(/\s+/g, " ");
    }

    function normalizeSearchText(value) {
        let normalizedValue = normalizeWhitespace(value).toLowerCase();

        try {
            normalizedValue = normalizedValue.normalize("NFKD");
        } catch (error) {
            normalizedValue = normalizedValue;
        }

        normalizedValue = normalizedValue
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ё/g, "е");

        try {
            normalizedValue = normalizedValue.replace(/[^\p{L}\p{N}]+/gu, " ");
        } catch (error) {
            normalizedValue = normalizedValue.replace(/[^a-zа-я0-9]+/gi, " ");
        }

        return normalizedValue.replace(/\s+/g, " ").trim();
    }

    function tokenizeQuery(value) {
        const normalizedQuery = normalizeSearchText(value);

        return normalizedQuery ? normalizedQuery.split(" ").filter(Boolean) : [];
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

    function collectLocaleTexts(record) {
        if (!record || typeof record !== "object") {
            return [];
        }

        return uniqueValues([record.ru, record.en]);
    }

    function collectLocaleArrayTexts(record) {
        if (!record || typeof record !== "object") {
            return [];
        }

        const values = [];

        if (Array.isArray(record.ru)) {
            values.push(...record.ru);
        }

        if (Array.isArray(record.en)) {
            values.push(...record.en);
        }

        return uniqueValues(values);
    }

    function buildSearchDocument(entry) {
        return {
            entry,
            labels: collectLocaleTexts(entry.label).map(normalizeSearchText).filter(Boolean),
            keywords: collectLocaleArrayTexts(entry.keywords).map(normalizeSearchText).filter(Boolean),
            descriptions: collectLocaleTexts(entry.description).map(normalizeSearchText).filter(Boolean)
        };
    }

    function bestFieldScore(values, token, scores) {
        if (!token) {
            return 0;
        }

        let bestScore = 0;

        values.forEach((value) => {
            if (!value) {
                return;
            }

            if (value === token) {
                bestScore = Math.max(bestScore, scores.exact);
                return;
            }

            if (value.startsWith(token)) {
                bestScore = Math.max(bestScore, scores.startsWith);
                return;
            }

            if (value.includes(token)) {
                bestScore = Math.max(bestScore, scores.includes);
            }
        });

        return bestScore;
    }

    function getMatchScore(searchDocument, query) {
        const normalizedQuery = normalizeSearchText(query);
        const tokens = tokenizeQuery(query);
        let score = Number(searchDocument.entry.priority) || 0;

        if (!normalizedQuery || !tokens.length) {
            return 0;
        }

        score += bestFieldScore(searchDocument.labels, normalizedQuery, {
            exact: 640,
            startsWith: 460,
            includes: 320
        });
        score += bestFieldScore(searchDocument.keywords, normalizedQuery, {
            exact: 280,
            startsWith: 220,
            includes: 170
        });
        score += bestFieldScore(searchDocument.descriptions, normalizedQuery, {
            exact: 110,
            startsWith: 84,
            includes: 62
        });

        for (const token of tokens) {
            const tokenScore = Math.max(
                bestFieldScore(searchDocument.labels, token, {
                    exact: 160,
                    startsWith: 128,
                    includes: 104
                }),
                bestFieldScore(searchDocument.keywords, token, {
                    exact: 96,
                    startsWith: 80,
                    includes: 64
                }),
                bestFieldScore(searchDocument.descriptions, token, {
                    exact: 34,
                    startsWith: 24,
                    includes: 18
                })
            );

            if (!tokenScore) {
                return 0;
            }

            score += tokenScore;
        }

        return score;
    }

    function localizeText(record, locale) {
        if (!searchIndexRuntime || typeof searchIndexRuntime.localizeText !== "function") {
            return "";
        }

        return searchIndexRuntime.localizeText(record, locale);
    }

    function resolveTarget(entry, locale) {
        if (!searchIndexRuntime || typeof searchIndexRuntime.resolveTarget !== "function") {
            return "";
        }

        return searchIndexRuntime.resolveTarget(entry, locale);
    }

    function getTypeLabel(type, locale) {
        const labels = uiText[locale] || uiText.en;

        return labels.types[type] || labels.types.page;
    }

    function truncateDescription(value) {
        const nextValue = normalizeWhitespace(value);

        return nextValue.length > 180 ? `${nextValue.slice(0, 177).trim()}...` : nextValue;
    }

    function detectQueryLocale(query, fallbackLocale) {
        const normalizedQuery = normalizeWhitespace(query);
        const hasCyrillic = /[А-Яа-яЁё]/.test(normalizedQuery);
        const hasLatin = /[A-Za-z]/.test(normalizedQuery);

        if (hasCyrillic && !hasLatin) {
            return "ru";
        }

        if (hasLatin && !hasCyrillic) {
            return "en";
        }

        return fallbackLocale === "ru" ? "ru" : "en";
    }

    function normalizeSearchChar(value) {
        let normalizedValue = String(value || "").toLowerCase();

        try {
            normalizedValue = normalizedValue.normalize("NFKD");
        } catch (error) {
            normalizedValue = normalizedValue;
        }

        normalizedValue = normalizedValue
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ё/g, "е");

        try {
            normalizedValue = normalizedValue.replace(/[^\p{L}\p{N}]+/gu, " ");
        } catch (error) {
            normalizedValue = normalizedValue.replace(/[^a-zа-я0-9]+/gi, " ");
        }

        return normalizedValue;
    }

    function buildNormalizedTextIndex(value) {
        const originalText = normalizeWhitespace(value);
        const positions = [];
        let normalizedText = "";
        let previousWasSpace = false;
        let offset = 0;

        for (const character of originalText) {
            const normalizedCharacter = normalizeSearchChar(character);

            for (const normalizedUnit of normalizedCharacter) {
                const isSpace = normalizedUnit === " ";

                if (isSpace && (!normalizedText || previousWasSpace)) {
                    continue;
                }

                normalizedText += normalizedUnit;
                positions.push({
                    start: offset,
                    end: offset + character.length
                });
                previousWasSpace = isSpace;
            }

            offset += character.length;
        }

        if (normalizedText.endsWith(" ")) {
            normalizedText = normalizedText.slice(0, -1);
            positions.pop();
        }

        return {
            originalText,
            normalizedText,
            positions
        };
    }

    function isWordCharacter(character) {
        const nextCharacter = String(character || "");

        if (!nextCharacter) {
            return false;
        }

        try {
            return /[\p{L}\p{N}]/u.test(nextCharacter);
        } catch (error) {
            return /[A-Za-zА-Яа-яЁё0-9]/.test(nextCharacter);
        }
    }

    function expandRangeToWord(text, range) {
        const safeText = String(text || "");
        let start = Math.max(0, Number(range && range.start) || 0);
        let end = Math.min(safeText.length, Number(range && range.end) || 0);

        while (start > 0 && isWordCharacter(safeText[start - 1])) {
            start -= 1;
        }

        while (end < safeText.length && isWordCharacter(safeText[end])) {
            end += 1;
        }

        return {
            start,
            end
        };
    }

    function mergeRanges(ranges) {
        if (!ranges.length) {
            return [];
        }

        const sortedRanges = ranges
            .slice()
            .sort((leftRange, rightRange) => leftRange.start - rightRange.start || leftRange.end - rightRange.end);
        const mergedRanges = [sortedRanges[0]];

        for (let index = 1; index < sortedRanges.length; index += 1) {
            const currentRange = sortedRanges[index];
            const lastRange = mergedRanges[mergedRanges.length - 1];

            if (currentRange.start <= lastRange.end) {
                lastRange.end = Math.max(lastRange.end, currentRange.end);
                continue;
            }

            mergedRanges.push({
                start: currentRange.start,
                end: currentRange.end
            });
        }

        return mergedRanges;
    }

    function getTokenMatchRanges(value, queryTokens) {
        const tokens = Array.isArray(queryTokens) ? uniqueValues(queryTokens.map(normalizeSearchText).filter(Boolean)) : [];

        if (!tokens.length) {
            return [];
        }

        const textIndex = buildNormalizedTextIndex(value);
        const ranges = [];

        if (!textIndex.normalizedText) {
            return [];
        }

        tokens.forEach((token) => {
            let matchIndex = textIndex.normalizedText.indexOf(token);

            while (matchIndex >= 0) {
                const startPosition = textIndex.positions[matchIndex];
                const endPosition = textIndex.positions[matchIndex + token.length - 1];

                if (startPosition && endPosition) {
                    ranges.push(expandRangeToWord(textIndex.originalText, {
                        start: startPosition.start,
                        end: endPosition.end
                    }));
                }

                matchIndex = textIndex.normalizedText.indexOf(token, matchIndex + token.length);
            }
        });

        return mergeRanges(ranges);
    }

    function moveSnippetStart(text, preferredStart) {
        if (preferredStart <= 0) {
            return 0;
        }

        const windowStart = Math.max(0, preferredStart - 16);
        const boundaryIndex = text.lastIndexOf(" ", preferredStart);

        if (boundaryIndex < windowStart) {
            return preferredStart;
        }

        return boundaryIndex + 1;
    }

    function moveSnippetEnd(text, preferredEnd) {
        if (preferredEnd >= text.length) {
            return text.length;
        }

        const windowEnd = Math.min(text.length, preferredEnd + 16);
        const boundaryIndex = text.indexOf(" ", preferredEnd);

        if (boundaryIndex === -1 || boundaryIndex > windowEnd) {
            return preferredEnd;
        }

        return boundaryIndex;
    }

    function buildSnippetData(value, queryTokens) {
        const text = normalizeWhitespace(value);
        const matchRanges = getTokenMatchRanges(text, queryTokens);

        if (!text) {
            return {
                text: "",
                highlightRanges: []
            };
        }

        if (!matchRanges.length) {
            return {
                text: truncateDescription(text),
                highlightRanges: []
            };
        }

        const firstMatch = matchRanges[0];
        const contextBefore = 44;
        const contextAfter = 76;
        const rawStart = Math.max(0, firstMatch.start - contextBefore);
        const rawEnd = Math.min(text.length, firstMatch.end + contextAfter);
        const snippetStart = moveSnippetStart(text, rawStart);
        const snippetEnd = moveSnippetEnd(text, rawEnd);
        const prefix = snippetStart > 0 ? "..." : "";
        const suffix = snippetEnd < text.length ? "..." : "";
        const snippetText = `${prefix}${text.slice(snippetStart, snippetEnd).trim()}${suffix}`;
        const highlightOffset = prefix.length - snippetStart;
        const snippetRanges = matchRanges
            .map((range) => ({
                start: range.start + highlightOffset,
                end: range.end + highlightOffset
            }))
            .filter((range) => range.end > prefix.length && range.start < snippetText.length)
            .map((range) => ({
                start: Math.max(prefix.length, range.start),
                end: Math.min(snippetText.length - suffix.length, range.end)
            }))
            .filter((range) => range.end > range.start);

        return {
            text: snippetText,
            highlightRanges: mergeRanges(snippetRanges)
        };
    }

    function createHighlightedFragment(text, ranges) {
        const fragment = document.createDocumentFragment();
        const safeText = String(text || "");
        const highlightRanges = Array.isArray(ranges) ? mergeRanges(ranges) : [];
        let cursor = 0;

        if (!highlightRanges.length) {
            fragment.append(document.createTextNode(safeText));
            return fragment;
        }

        highlightRanges.forEach((range) => {
            if (range.start > cursor) {
                fragment.append(document.createTextNode(safeText.slice(cursor, range.start)));
            }

            if (range.end > range.start) {
                const highlight = document.createElement("mark");

                highlight.className = "quick-search-highlight";
                highlight.textContent = safeText.slice(range.start, range.end);
                fragment.append(highlight);
            }

            cursor = Math.max(cursor, range.end);
        });

        if (cursor < safeText.length) {
            fragment.append(document.createTextNode(safeText.slice(cursor)));
        }

        return fragment;
    }

    function toDomIdPart(value) {
        return textValue(value).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "entry";
    }

    function scrollToSelector(selector) {
        const nextSelector = textValue(selector);
        let targetElement = null;

        if (!nextSelector) {
            return false;
        }

        if (nextSelector.startsWith("#")) {
            let elementId = nextSelector.slice(1);

            try {
                elementId = decodeURIComponent(elementId);
            } catch (error) {
                elementId = nextSelector.slice(1);
            }

            try {
                targetElement = document.getElementById(elementId) || document.querySelector(nextSelector);
            } catch (error) {
                targetElement = document.getElementById(elementId);
            }
        } else {
            try {
                targetElement = document.querySelector(nextSelector);
            } catch (error) {
                targetElement = null;
            }
        }

        if (!targetElement) {
            return false;
        }

        if (nextSelector.startsWith("#") && window.history && typeof window.history.pushState === "function") {
            const nextUrl = `${window.location.pathname}${window.location.search}${nextSelector}`;

            if (window.location.hash !== nextSelector) {
                window.history.pushState({}, "", nextUrl);
            }
        }

        if (!targetElement.hasAttribute("tabindex")) {
            targetElement.setAttribute("tabindex", "-1");
        }

        targetElement.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        if (typeof targetElement.focus === "function") {
            window.requestAnimationFrame(() => {
                try {
                    targetElement.focus({
                        preventScroll: true
                    });
                } catch (error) {
                    targetElement.focus();
                }
            });
        }

        return true;
    }

    function navigateToTarget(target) {
        const nextTarget = textValue(target);

        if (!nextTarget) {
            return;
        }

        if (nextTarget.startsWith("#")) {
            if (scrollToSelector(nextTarget)) {
                return;
            }
        }

        let targetUrl = null;

        try {
            targetUrl = new URL(nextTarget, window.location.origin);
        } catch (error) {
            window.location.assign(nextTarget);
            return;
        }

        if (
            targetUrl.origin === window.location.origin &&
            targetUrl.pathname === window.location.pathname &&
            targetUrl.search === window.location.search
        ) {
            if (targetUrl.hash && scrollToSelector(targetUrl.hash)) {
                return;
            }

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
            return;
        }

        window.location.assign(targetUrl.toString());
    }

    function createResultNode(searchDocument, index, state) {
        const entry = searchDocument.entry;
        const item = document.createElement("li");
        const button = document.createElement("button");
        const meta = document.createElement("div");
        const type = document.createElement("span");
        const label = document.createElement("span");
        const labelText = localizeText(entry.label, state.displayLocale);
        const labelRanges = getTokenMatchRanges(labelText, state.queryTokens);
        const snippetData = buildSnippetData(localizeText(entry.description, state.displayLocale), state.queryTokens);
        const description = snippetData.text ? document.createElement("p") : null;

        item.className = "quick-search-result";

        button.type = "button";
        button.className = "quick-search-result-button";
        button.dataset.quickSearchResult = String(index);
        button.id = `${state.list.id}-${toDomIdPart(entry.id)}`;
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", String(index === state.activeIndex));

        if (index === state.activeIndex) {
            button.classList.add("is-active");
        }

        meta.className = "quick-search-result-meta";

        type.className = "quick-search-result-type";
        type.textContent = getTypeLabel(entry.type, state.displayLocale);

        label.className = "quick-search-result-label";
        label.append(createHighlightedFragment(labelText, labelRanges));

        meta.append(type);
        button.append(meta, label);

        if (description) {
            description.className = "quick-search-result-description";
            description.append(createHighlightedFragment(snippetData.text, snippetData.highlightRanges));
            button.append(description);
        }

        item.append(button);
        return item;
    }

    function setDropdownOpen(state, nextOpen) {
        state.open = Boolean(nextOpen);
        state.root.dataset.open = String(state.open);
        state.dropdown.hidden = !state.open;
        state.input.setAttribute("aria-expanded", String(state.open));

        if (!state.open) {
            state.activeIndex = -1;
            state.input.removeAttribute("aria-activedescendant");
        }
    }

    function syncActiveDescendant(state) {
        const activeButton = state.list.querySelector(`[data-quick-search-result="${state.activeIndex}"]`);

        if (!activeButton) {
            state.input.removeAttribute("aria-activedescendant");
            return;
        }

        state.input.setAttribute("aria-activedescendant", activeButton.id);
        activeButton.scrollIntoView({
            block: "nearest"
        });
    }

    function getRankedResults(state, query) {
        return state.documents
            .map((searchDocument) => ({
                searchDocument,
                score: getMatchScore(searchDocument, query)
            }))
            .filter((match) => match.score > 0)
            .sort((leftMatch, rightMatch) => {
                if (leftMatch.score !== rightMatch.score) {
                    return rightMatch.score - leftMatch.score;
                }

                return (Number(rightMatch.searchDocument.entry.priority) || 0) - (Number(leftMatch.searchDocument.entry.priority) || 0);
            })
            .map((match) => match.searchDocument);
    }

    function renderState(state) {
        const query = textValue(state.input.value);
        const queryTokens = tokenizeQuery(query);
        const displayLocale = detectQueryLocale(query, state.locale);
        const results = query ? getRankedResults(state, query) : [];
        const hasResults = results.length > 0;
        const displayLabels = uiText[displayLocale] || uiText.en;
        const interfaceLabels = uiText[state.locale] || uiText.en;

        state.displayLocale = displayLocale;
        state.queryTokens = queryTokens;
        state.results = results;

        if (!query) {
            state.activeIndex = -1;
        } else if (!hasResults) {
            state.activeIndex = -1;
        } else if (state.activeIndex >= results.length) {
            state.activeIndex = results.length - 1;
        }

        state.list.replaceChildren(...results.map((result, index) => createResultNode(result, index, state)));
        state.count.hidden = !hasResults;
        state.count.textContent = hasResults ? interfaceLabels.count(results.length) : "";
        state.empty.hidden = hasResults;
        state.empty.textContent = query ? displayLabels.empty : "";
        syncActiveDescendant(state);

        if (!query) {
            setDropdownOpen(state, false);
            return;
        }

        setDropdownOpen(state, state.hasFocus || Boolean(query));
    }

    function rebuildDocuments(state) {
        state.documents = state.entries.map(buildSearchDocument);
        renderState(state);
    }

    function syncEntries(state) {
        state.entries = state.staticEntries.concat(state.dynamicEntries);
        rebuildDocuments(state);
    }

    function syncDynamicNewsEntries(state) {
        if (!searchIndexRuntime || typeof searchIndexRuntime.createNewsEntries !== "function") {
            return;
        }

        state.dynamicEntries = searchIndexRuntime.createNewsEntries(state.newsByLocale);
        syncEntries(state);
    }

    function readCachedNews(state) {
        if (!newsPrefetchRuntime || typeof newsPrefetchRuntime.readCachedNews !== "function") {
            return;
        }

        state.supportedLocales.forEach((locale) => {
            const cachedItems = newsPrefetchRuntime.readCachedNews(locale);

            if (cachedItems) {
                state.newsByLocale[locale] = cachedItems;
            }
        });

        syncDynamicNewsEntries(state);
    }

    function startNewsHydration(state) {
        if (
            state.newsHydrationStarted ||
            !newsPrefetchRuntime ||
            typeof newsPrefetchRuntime.prefetchNews !== "function"
        ) {
            return;
        }

        state.newsHydrationStarted = true;

        state.supportedLocales.forEach((locale) => {
            newsPrefetchRuntime
                .prefetchNews(locale, {
                    forceRefresh: false,
                    reason: "quick-search-index"
                })
                .then((items) => {
                    if (!Array.isArray(items)) {
                        return;
                    }

                    state.newsByLocale[locale] = items;
                    syncDynamicNewsEntries(state);
                })
                .catch(() => {
                    return;
                });
        });
    }

    function activateResult(state, nextIndex) {
        if (!state.results.length) {
            state.activeIndex = -1;
            syncActiveDescendant(state);
            return;
        }

        if (nextIndex < 0) {
            state.activeIndex = state.results.length - 1;
        } else if (nextIndex >= state.results.length) {
            state.activeIndex = 0;
        } else {
            state.activeIndex = nextIndex;
        }

        renderState(state);
    }

    function openActiveResult(state) {
        const fallbackIndex = state.activeIndex >= 0 ? state.activeIndex : 0;
        const activeResult = state.results[fallbackIndex];

        if (!activeResult) {
            return;
        }

        setDropdownOpen(state, false);
        navigateToTarget(resolveTarget(activeResult.entry, state.locale));
    }

    function initQuickSearch(root) {
        const locale = searchIndexRuntime.detectLocale();
        const labels = uiText[locale] || uiText.en;
        const input = root.querySelector("[data-quick-search-input]");
        const dropdown = root.querySelector("[data-quick-search-dropdown]");
        const list = root.querySelector("[data-quick-search-results]");
        const empty = root.querySelector("[data-quick-search-empty]");
        let count = root.querySelector("[data-quick-search-count]");

        if (!input || !dropdown || !list || !empty) {
            return;
        }

        if (!count) {
            count = document.createElement("p");
            count.className = "quick-search-count";
            count.dataset.quickSearchCount = "";
            count.hidden = true;
            dropdown.append(count);
        }

        list.style.setProperty("--quick-search-visible-results", String(visibleResultCount));

        const state = {
            root,
            locale,
            displayLocale: locale,
            labels,
            input,
            dropdown,
            list,
            empty,
            count,
            open: false,
            hasFocus: false,
            activeIndex: -1,
            queryTokens: [],
            results: [],
            documents: [],
            entries: [],
            staticEntries: searchIndexRuntime.buildStaticEntries(),
            dynamicEntries: [],
            supportedLocales: Array.isArray(searchIndexRuntime.supportedLocales)
                ? searchIndexRuntime.supportedLocales.slice()
                : ["ru", "en"],
            newsByLocale: {},
            newsHydrationStarted: false
        };

        input.placeholder = labels.placeholder;
        input.setAttribute("aria-label", labels.ariaLabel);
        input.setAttribute("aria-haspopup", "listbox");
        input.setAttribute("aria-expanded", "false");

        readCachedNews(state);
        syncEntries(state);

        input.addEventListener("focus", () => {
            state.hasFocus = true;
            setDropdownOpen(state, true);
            renderState(state);
            startNewsHydration(state);
        });

        input.addEventListener("input", () => {
            setDropdownOpen(state, true);
            renderState(state);
            startNewsHydration(state);
        });

        input.addEventListener("keydown", (event) => {
            if (event.key === "ArrowDown") {
                event.preventDefault();
                if (!state.open) {
                    setDropdownOpen(state, true);
                }
                activateResult(state, state.activeIndex + 1);
                return;
            }

            if (event.key === "ArrowUp") {
                event.preventDefault();
                if (!state.open) {
                    setDropdownOpen(state, true);
                }
                activateResult(state, state.activeIndex - 1);
                return;
            }

            if (event.key === "Enter") {
                if (!state.results.length) {
                    return;
                }

                event.preventDefault();
                openActiveResult(state);
                return;
            }

            if (event.key === "Escape") {
                if (!state.open) {
                    return;
                }

                event.preventDefault();
                setDropdownOpen(state, false);
            }
        });

        list.addEventListener("mousedown", (event) => {
            const button = event.target.closest("[data-quick-search-result]");

            if (!button) {
                return;
            }

            event.preventDefault();
        });

        list.addEventListener("mousemove", (event) => {
            const button = event.target.closest("[data-quick-search-result]");

            if (!button) {
                return;
            }

            const nextIndex = Number(button.dataset.quickSearchResult);

            if (!Number.isNaN(nextIndex) && nextIndex !== state.activeIndex) {
                state.activeIndex = nextIndex;
                renderState(state);
            }
        });

        list.addEventListener("click", (event) => {
            const button = event.target.closest("[data-quick-search-result]");

            if (!button) {
                return;
            }

            const nextIndex = Number(button.dataset.quickSearchResult);

            if (Number.isNaN(nextIndex)) {
                return;
            }

            state.activeIndex = nextIndex;
            openActiveResult(state);
        });

        root.addEventListener("focusout", (event) => {
            const nextTarget = event.relatedTarget;

            if (nextTarget && root.contains(nextTarget)) {
                return;
            }

            state.hasFocus = false;
            window.setTimeout(() => {
                if (!root.contains(document.activeElement)) {
                    setDropdownOpen(state, false);
                }
            }, 0);
        });

        document.addEventListener("pointerdown", (event) => {
            if (root.contains(event.target)) {
                return;
            }

            state.hasFocus = false;
            setDropdownOpen(state, false);
        });
    }

    if (!searchIndexRuntime || typeof searchIndexRuntime.buildStaticEntries !== "function") {
        return;
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll("[data-quick-search]").forEach((root) => {
            initQuickSearch(root);
        });
    });
})();
