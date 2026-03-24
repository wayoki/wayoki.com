(function () {
    const themeStorageKey = "wayoki-localized-theme";
    const fallbackTheme = "light";
    const fallbackThemeCatalog = {
        light: {
            group: "core",
            credit: ""
        },
        dark: {
            group: "core",
            credit: ""
        },
        "author-1": {
            group: "author",
            credit: "by author"
        },
        "author-2": {
            group: "author",
            credit: "by author"
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
        applyTheme,
        bootstrapTheme
    };
})();
