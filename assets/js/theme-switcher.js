(function () {
    const themeStorageKey = "wayoki-localized-theme";
    const fallbackTheme = "light";
    const runtimeThemeStyleId = "wayoki-runtime-theme-style";
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

    function textValue(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeTheme(theme) {
        return isSupportedTheme(theme) ? theme : defaultTheme;
    }

    function readStoredTheme() {
        try {
            const storedTheme = localStorage.getItem(themeStorageKey);

            if (!storedTheme) {
                return defaultTheme;
            }

            if (isSupportedTheme(storedTheme)) {
                return storedTheme;
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
        const credit = getThemeMeta(nextTheme).credit;

        root.querySelectorAll("[data-theme-credit]").forEach((element) => {
            element.textContent = credit;
            element.dataset.themeCreditFor = nextTheme;
            element.hidden = !credit;
        });
    }

    function applyTheme(theme, options = {}) {
        const nextTheme = normalizeTheme(theme);
        const root = options.root || document;

        document.documentElement.dataset.theme = nextTheme;
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
        syncThemeButtons,
        syncThemeCredits,
        getThemeTokens,
        applyTheme,
        bootstrapTheme
    };
})();
