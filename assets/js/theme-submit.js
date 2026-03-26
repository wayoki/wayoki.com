(function () {
    const themeRuntime = window.WayokiThemeSwitcher || null;
    const submitConfigRuntime = window.WayokiThemeSubmitConfig || {};
    const transliterationMap = {
        а: "a",
        б: "b",
        в: "v",
        г: "g",
        д: "d",
        е: "e",
        ё: "e",
        ж: "zh",
        з: "z",
        и: "i",
        й: "y",
        к: "k",
        л: "l",
        м: "m",
        н: "n",
        о: "o",
        п: "p",
        р: "r",
        с: "s",
        т: "t",
        у: "u",
        ф: "f",
        х: "h",
        ц: "ts",
        ч: "ch",
        ш: "sh",
        щ: "sch",
        ъ: "",
        ы: "y",
        ь: "",
        э: "e",
        ю: "yu",
        я: "ya"
    };
    const editableThemeTokens = [
        "--theme-color-scheme",
        "--color-accent",
        "--color-accent-hover",
        "--color-bg",
        "--color-bg-secondary",
        "--color-bg-tertiary",
        "--color-bg-highlight",
        "--color-bg-glow",
        "--color-bg-accent",
        "--color-surface",
        "--color-surface-strong",
        "--color-surface-elevated",
        "--color-card",
        "--color-card-strong",
        "--color-chip",
        "--color-chip-hover",
        "--color-toggle-active",
        "--color-text-primary",
        "--color-text-secondary",
        "--color-text-muted",
        "--color-border",
        "--color-border-strong",
        "--color-border-inset",
        "--color-link",
        "--color-link-hover",
        "--color-overlay",
        "--shadow-soft",
        "--shadow-medium",
        "--shadow-large",
        "--landing-color-bg",
        "--landing-color-text-primary",
        "--landing-color-text-secondary",
        "--landing-color-pixel",
        "--landing-color-divider",
        "--landing-paper-bg",
        "--landing-paper-text",
        "--landing-paper-gradient",
        "--page-backdrop-gradient",
        "--feature-plaque-background",
        "--feature-plaque-shadow"
    ];
    const localeMessages = {
        ru: {
            invalidThemeName: "Укажите имя темы.",
            invalidAuthorName: "Укажите имя автора.",
            invalidThemeSlug: "Имя темы должно содержать хотя бы одну букву или цифру после нормализации.",
            invalidAuthorSlug: "Имя автора должно содержать хотя бы одну букву или цифру после нормализации.",
            invalidTokens: "Не удалось собрать редактируемые токены темы."
        },
        en: {
            invalidThemeName: "Please provide a theme name.",
            invalidAuthorName: "Please provide an author name.",
            invalidThemeSlug: "Theme name must contain at least one letter or digit after normalization.",
            invalidAuthorSlug: "Author name must contain at least one letter or digit after normalization.",
            invalidTokens: "Couldn't collect editable tokens."
        }
    };
    const submitLinkKeys = [
        "pullRequestUrl",
        "prUrl",
        "pr_url",
        "pull_request_url",
        "html_url",
        "url",
        "link"
    ];

    function textValue(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function slugify(value) {
        const input = textValue(value)
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
        let transliterated = "";

        for (const character of input) {
            transliterated += Object.prototype.hasOwnProperty.call(transliterationMap, character)
                ? transliterationMap[character]
                : character;
        }

        return transliterated
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/-{2,}/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function buildSubmissionIdentity(themeName, authorName) {
        const normalizedThemeName = textValue(themeName);
        const normalizedAuthorName = textValue(authorName);
        const themeSlug = slugify(normalizedThemeName);
        const authorSlug = slugify(normalizedAuthorName);

        return {
            themeName: normalizedThemeName,
            authorName: normalizedAuthorName,
            themeSlug,
            authorSlug,
            catalogKey: authorSlug && themeSlug ? `${authorSlug}/${themeSlug}` : "",
            filePath: authorSlug && themeSlug ? `collab/site-ui/submissions/${authorSlug}/${themeSlug}.json` : ""
        };
    }

    function detectLocale() {
        const lang = textValue(document.documentElement.lang).toLowerCase();

        if (lang.startsWith("ru")) {
            return "ru";
        }

        const pathname = window.location.pathname.toLowerCase();
        return pathname === "/ru" || pathname.startsWith("/ru/") ? "ru" : "en";
    }

    function getLocaleMessages(locale) {
        return localeMessages[locale === "ru" ? "ru" : "en"];
    }

    function getConfiguredEndpoint(sourceElement) {
        const elementEndpoint = textValue(sourceElement && sourceElement.dataset ? sourceElement.dataset.themeSubmitEndpoint : "");
        const documentEndpoint = textValue(document.documentElement.dataset.themeSubmitEndpoint);
        const configuredEndpoint = textValue(submitConfigRuntime.endpoint);

        return elementEndpoint || documentEndpoint || configuredEndpoint;
    }

    function resolveEndpointUrl(endpoint) {
        const configuredEndpoint = textValue(endpoint) || getConfiguredEndpoint();

        if (!configuredEndpoint) {
            return "";
        }

        try {
            const resolvedUrl = new URL(configuredEndpoint, window.location.origin);

            if (resolvedUrl.protocol !== "http:" && resolvedUrl.protocol !== "https:") {
                return "";
            }

            return resolvedUrl.toString();
        } catch (error) {
            return "";
        }
    }

    function getTimeoutMs() {
        const configuredTimeout = Number(submitConfigRuntime.timeoutMs);

        return configuredTimeout > 0 ? configuredTimeout : 12000;
    }

    function normalizeTheme(theme) {
        if (themeRuntime && typeof themeRuntime.normalizeTheme === "function") {
            return themeRuntime.normalizeTheme(theme);
        }

        return textValue(theme) || "light";
    }

    function getThemeMeta(theme) {
        if (themeRuntime && typeof themeRuntime.getThemeMeta === "function") {
            return themeRuntime.getThemeMeta(theme) || null;
        }

        return null;
    }

    function getCurrentTheme() {
        if (themeRuntime && typeof themeRuntime.readActiveTheme === "function") {
            return themeRuntime.readActiveTheme();
        }

        return normalizeTheme(document.documentElement.dataset.theme);
    }

    function getBaseTheme(theme) {
        if (themeRuntime && typeof themeRuntime.getBaseTheme === "function") {
            return themeRuntime.getBaseTheme(theme);
        }

        return normalizeTheme(theme);
    }

    function readThemeCredit(theme) {
        const themeMeta = getThemeMeta(theme);

        return themeMeta && typeof themeMeta.credit === "string" ? themeMeta.credit : "";
    }

    function collectEditableTokens() {
        const computedStyle = window.getComputedStyle(document.documentElement);
        const tokens = {};

        editableThemeTokens.forEach((tokenName) => {
            const tokenValue = textValue(computedStyle.getPropertyValue(tokenName));

            if (tokenValue) {
                tokens[tokenName] = tokenValue;
            }
        });

        return tokens;
    }

    function collectProvidedTokens(providedTokens) {
        if (!providedTokens || typeof providedTokens !== "object" || Array.isArray(providedTokens)) {
            return {};
        }

        return editableThemeTokens.reduce((result, tokenName) => {
            const tokenValue = textValue(providedTokens[tokenName]);

            if (tokenValue) {
                result[tokenName] = tokenValue;
            }

            return result;
        }, {});
    }

    function createThemePayload(fields = {}) {
        const identity = buildSubmissionIdentity(fields.themeName, fields.authorName);
        const themeName = identity.themeName;
        const authorName = identity.authorName;
        const creditText = textValue(fields.creditText);
        const sourceTheme = getBaseTheme(textValue(fields.sourceTheme) || getCurrentTheme());
        const providedTokens = collectProvidedTokens(fields.tokens);
        const tokens = Object.keys(providedTokens).length ? providedTokens : collectEditableTokens();
        const payload = {
            themeName,
            authorName,
            sourceTheme,
            submittedAt: new Date().toISOString(),
            tokens,
            meta: {
                siteLocale: detectLocale(),
                userAgent: textValue(window.navigator && window.navigator.userAgent),
                page: `${window.location.pathname}${window.location.search}`
            }
        };

        if (creditText) {
            payload.creditText = creditText;
        }

        return payload;
    }

    function validateThemePayload(payload, localeOrMessages) {
        const messages =
            typeof localeOrMessages === "string"
                ? getLocaleMessages(localeOrMessages)
                : localeOrMessages || getLocaleMessages(detectLocale());

        if (!payload || !textValue(payload.themeName)) {
            return messages.invalidThemeName;
        }

        if (!textValue(payload.authorName)) {
            return messages.invalidAuthorName;
        }

        if (!slugify(payload.themeName)) {
            return messages.invalidThemeSlug;
        }

        if (!slugify(payload.authorName)) {
            return messages.invalidAuthorSlug;
        }

        if (!payload.tokens || !Object.keys(payload.tokens).length) {
            return messages.invalidTokens;
        }

        return "";
    }

    function getPrettyJson(payload) {
        return JSON.stringify(payload, null, 2);
    }

    function sanitizeFileName(value) {
        const baseName = textValue(value)
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "-")
            .replace(/^-+|-+$/g, "");

        return baseName || "theme-preset";
    }

    function downloadPayload(payload) {
        const json = getPrettyJson(payload);
        const blob = new Blob([json], {
            type: "application/json"
        });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");

        anchor.href = objectUrl;
        anchor.download = `${sanitizeFileName(payload.themeName)}.json`;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();

        window.setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
        }, 0);
    }

    function fallbackCopyText(value) {
        const textarea = document.createElement("textarea");

        textarea.value = value;
        textarea.setAttribute("readonly", "readonly");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        document.body.append(textarea);
        textarea.focus();
        textarea.select();

        try {
            return document.execCommand("copy");
        } catch (error) {
            return false;
        } finally {
            textarea.remove();
        }
    }

    function copyPayload(payload) {
        const json = getPrettyJson(payload);

        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            return navigator.clipboard.writeText(json);
        }

        return fallbackCopyText(json) ? Promise.resolve() : Promise.reject(new Error("Copy is unavailable"));
    }

    function createAbortOptions(timeoutMs) {
        if (typeof AbortController !== "function") {
            return {
                signal: null,
                cleanup() {}
            };
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => {
            controller.abort();
        }, timeoutMs);

        return {
            signal: controller.signal,
            cleanup() {
                window.clearTimeout(timeoutId);
            }
        };
    }

    function extractSubmitLink(payload) {
        if (!payload || typeof payload !== "object") {
            return "";
        }

        for (const key of submitLinkKeys) {
            const value = textValue(payload[key]);

            if (value) {
                return value;
            }
        }

        if (payload.pull_request && typeof payload.pull_request === "object") {
            const nestedValue = textValue(payload.pull_request.html_url || payload.pull_request.url || payload.pull_request.link);

            if (nestedValue) {
                return nestedValue;
            }
        }

        return "";
    }

    function extractLinkFromText(value) {
        const match = textValue(value).match(/https?:\/\/\S+/i);

        return match ? match[0] : "";
    }

    function extractResponseMessage(parsed) {
        if (parsed && parsed.data && typeof parsed.data === "object") {
            const candidates = ["message", "error", "detail", "statusText"];

            for (const key of candidates) {
                const nextValue = textValue(parsed.data[key]);

                if (nextValue) {
                    return nextValue;
                }
            }
        }

        return textValue(parsed && parsed.text);
    }

    function parseResponseBody(response) {
        const contentType = textValue(response.headers.get("content-type")).toLowerCase();

        if (contentType.includes("application/json")) {
            return response
                .json()
                .then((data) => ({
                    data,
                    text: ""
                }))
                .catch(() => ({
                    data: null,
                    text: ""
                }));
        }

        return response
            .text()
            .then((text) => ({
                data: null,
                text
            }))
            .catch(() => ({
                data: null,
                text: ""
            }));
    }

    function submitPayload(payload, endpoint) {
        const resolvedEndpoint = resolveEndpointUrl(endpoint);
        const abortOptions = createAbortOptions(getTimeoutMs());

        if (!resolvedEndpoint) {
            const error = new Error("Theme submit endpoint is invalid or not configured");
            error.result = {
                response: null,
                data: {
                    code: "invalid_endpoint"
                },
                text: "",
                message: error.message,
                link: ""
            };
            throw error;
        }

        return fetch(resolvedEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: getPrettyJson(payload),
            signal: abortOptions.signal || undefined
        })
            .then((response) =>
                parseResponseBody(response).then((parsed) => {
                    abortOptions.cleanup();

                    const result = {
                        response,
                        data: parsed.data,
                        text: parsed.text,
                        message: extractResponseMessage(parsed),
                        link: extractSubmitLink(parsed.data) || extractLinkFromText(parsed.text)
                    };

                    if (!response.ok) {
                        const error = new Error(result.message || `Submit failed with status ${response.status}`);
                        error.result = result;
                        throw error;
                    }

                    return result;
                })
            )
            .catch((error) => {
                abortOptions.cleanup();
                throw error;
            });
    }

    window.WayokiThemeSubmit = {
        editableThemeTokens,
        detectLocale,
        getLocaleMessages,
        getConfiguredEndpoint,
        resolveEndpointUrl,
        getTimeoutMs,
        normalizeTheme,
        getThemeMeta,
        getCurrentTheme,
        readThemeCredit,
        slugify,
        buildSubmissionIdentity,
        collectEditableTokens,
        createThemePayload,
        validateThemePayload,
        getPrettyJson,
        downloadPayload,
        copyPayload,
        submitPayload,
        extractSubmitLink
    };
})();
