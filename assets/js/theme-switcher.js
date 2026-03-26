(function () {
    const themeStorageKey = "wayoki-localized-theme";
    const fallbackTheme = "light";
    const runtimeThemeStyleId = "wayoki-runtime-theme-style";
    const themeSelectionAttribute = "data-theme-selection";
    const fallbackThemeCatalog = {
        light: {
            group: "core",
            label: "Light",
            credit: ""
        },
        dark: {
            group: "core",
            label: "Dark",
            credit: ""
        }
    };
    const externalThemeRegistry = window.WayokiThemeRegistry || null;
    const themeCatalog =
        externalThemeRegistry &&
        externalThemeRegistry.themeCatalog &&
        typeof externalThemeRegistry.themeCatalog === "object"
            ? externalThemeRegistry.themeCatalog
            : fallbackThemeCatalog;
    const configuredDefaultTheme =
        externalThemeRegistry && typeof externalThemeRegistry.defaultTheme === "string"
            ? externalThemeRegistry.defaultTheme
            : fallbackTheme;
    const defaultTheme = Object.prototype.hasOwnProperty.call(themeCatalog, configuredDefaultTheme)
        ? configuredDefaultTheme
        : fallbackTheme;

    function isSupportedTheme(theme) {
        return Object.prototype.hasOwnProperty.call(themeCatalog, theme);
    }

    function isCoreTheme(theme) {
        const themeMeta = themeCatalog[theme];

        return Boolean(themeMeta && themeMeta.group !== "author");
    }

    function textValue(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeAuthorLink(value) {
        const rawValue = textValue(value);

        if (!rawValue) {
            return "";
        }

        let candidate = rawValue.replace(/^@+/u, "");

        if (!candidate) {
            return "";
        }

        if (/^\/\//u.test(candidate)) {
            candidate = `https:${candidate}`;
        } else if (!/^[a-z][a-z0-9+.-]*:/iu.test(candidate)) {
            if (!/[./]/u.test(candidate)) {
                return "";
            }

            candidate = `https://${candidate.replace(/^\/+/u, "")}`;
        }

        try {
            const url = new URL(candidate);

            if (url.protocol !== "https:" && url.protocol !== "http:") {
                return "";
            }

            if (!textValue(url.hostname) || !url.hostname.includes(".")) {
                return "";
            }

            return url.toString();
        } catch (error) {
            return "";
        }
    }

    function buildStableCustomThemeId(authorSlug, themeSlug) {
        const nextAuthorSlug = textValue(authorSlug);
        const nextThemeSlug = textValue(themeSlug);

        return nextAuthorSlug && nextThemeSlug ? `${nextAuthorSlug}/${nextThemeSlug}` : "";
    }

    function resolveLegacyThemeAlias(theme) {
        const nextTheme = textValue(theme);
        const legacyMatch = nextTheme.match(/^submission-([a-z0-9-]+)--([a-z0-9-]+)$/u);

        if (!legacyMatch) {
            return nextTheme;
        }

        return buildStableCustomThemeId(legacyMatch[1], legacyMatch[2]) || nextTheme;
    }

    function normalizeTheme(theme) {
        const nextTheme = textValue(theme);

        if (isSupportedTheme(nextTheme)) {
            return nextTheme;
        }

        const aliasedTheme = resolveLegacyThemeAlias(nextTheme);

        return isSupportedTheme(aliasedTheme) ? aliasedTheme : defaultTheme;
    }

    function getBaseTheme(theme) {
        const nextTheme = normalizeTheme(theme);
        const themeMeta = themeCatalog[nextTheme];
        const configuredSourceTheme = textValue(themeMeta && themeMeta.sourceTheme);

        if (configuredSourceTheme && isSupportedTheme(configuredSourceTheme) && isCoreTheme(configuredSourceTheme)) {
            return configuredSourceTheme;
        }

        return isCoreTheme(nextTheme) ? nextTheme : defaultTheme;
    }

    function readStoredTheme() {
        try {
            const storedTheme = localStorage.getItem(themeStorageKey);

            if (!storedTheme) {
                return defaultTheme;
            }

            const normalizedStoredTheme = normalizeTheme(storedTheme);

            if (normalizedStoredTheme !== defaultTheme || isSupportedTheme(storedTheme)) {
                if (normalizedStoredTheme !== storedTheme) {
                    localStorage.setItem(themeStorageKey, normalizedStoredTheme);
                }

                return normalizedStoredTheme;
            }

            localStorage.removeItem(themeStorageKey);
            return defaultTheme;
        } catch (error) {
            return defaultTheme;
        }
    }

    function persistTheme(theme) {
        try {
            localStorage.setItem(themeStorageKey, normalizeTheme(theme));
        } catch (error) {
            return;
        }
    }

    function selectTheme(theme, options = {}) {
        return applyTheme(theme, {
            ...options,
            persist: true
        });
    }

    function getThemeMeta(theme) {
        return themeCatalog[normalizeTheme(theme)];
    }

    function readActiveTheme() {
        const explicitSelection = textValue(document.documentElement.getAttribute(themeSelectionAttribute));

        if (explicitSelection) {
            return normalizeTheme(explicitSelection);
        }

        return normalizeTheme(document.documentElement.dataset.theme);
    }

    function getThemeTokens(theme) {
        const themeMeta = getThemeMeta(theme);
        const rawTokens = themeMeta && themeMeta.tokens && typeof themeMeta.tokens === "object" ? themeMeta.tokens : {};

        return Object.keys(rawTokens)
            .filter((tokenName) => tokenName.startsWith("--"))
            .sort()
            .reduce((result, tokenName) => {
                const tokenValue = textValue(rawTokens[tokenName]);

                if (tokenValue) {
                    result[tokenName] = tokenValue;
                }

                return result;
            }, {});
    }

    function getOrCreateRuntimeThemeStyle() {
        let styleElement = document.getElementById(runtimeThemeStyleId);

        if (styleElement) {
            return styleElement;
        }

        styleElement = document.createElement("style");
        styleElement.id = runtimeThemeStyleId;
        document.head.append(styleElement);
        return styleElement;
    }

    function serializeThemeTokens(tokens) {
        const probe = document.createElement("span");

        Object.keys(tokens).forEach((tokenName) => {
            probe.style.setProperty(tokenName, tokens[tokenName]);
        });

        return textValue(probe.style.cssText);
    }

    function syncRuntimeThemeTokens(theme) {
        const styleElement = getOrCreateRuntimeThemeStyle();
        const serializedTokens = serializeThemeTokens(getThemeTokens(theme));

        styleElement.textContent = serializedTokens ? `html { ${serializedTokens} }\n` : "";
    }

    function syncThemeButtons(root, theme) {
        const nextTheme = normalizeTheme(theme);

        root.querySelectorAll("[data-theme-option]").forEach((button) => {
            button.setAttribute("aria-pressed", String(button.dataset.themeOption === nextTheme));
        });
    }

    function syncThemeCredits(root, theme) {
        const nextTheme = normalizeTheme(theme);
        const themeMeta = getThemeMeta(nextTheme) || {};
        const credit = themeMeta.credit;
        const authorLink = normalizeAuthorLink(themeMeta.authorLink);

        root.querySelectorAll("[data-theme-credit]").forEach((element) => {
            element.dataset.themeCreditFor = nextTheme;
            element.hidden = !credit;

            if (!credit) {
                element.textContent = "";
                return;
            }

            if (!authorLink) {
                element.textContent = credit;
                return;
            }

            const link = document.createElement("a");

            link.className = "brand-credit-link";
            link.href = authorLink;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = credit;
            element.replaceChildren(link);
        });
    }

    function applyTheme(theme, options = {}) {
        const nextTheme = normalizeTheme(theme);
        const baseTheme = getBaseTheme(nextTheme);
        const root = options.root || document;

        document.documentElement.dataset.theme = baseTheme;
        document.documentElement.setAttribute(themeSelectionAttribute, nextTheme);
        syncRuntimeThemeTokens(nextTheme);
        syncThemeButtons(root, nextTheme);
        syncThemeCredits(root, nextTheme);

        if (options.persist) {
            persistTheme(nextTheme);
        }

        return nextTheme;
    }

    function bootstrapTheme() {
        return applyTheme(readStoredTheme());
    }

    bootstrapTheme();

    window.WayokiThemeSwitcher = {
        themeStorageKey,
        themeCatalog,
        isSupportedTheme,
        normalizeTheme,
        readStoredTheme,
        persistTheme,
        selectTheme,
        getThemeMeta,
        getBaseTheme,
        readActiveTheme,
        syncThemeButtons,
        syncThemeCredits,
        getThemeTokens,
        applyTheme,
        bootstrapTheme
    };
})();
