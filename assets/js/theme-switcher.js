(function () {
    const themeStorageKey = "wayoki-localized-theme";
    const fallbackTheme = "light";
    const themeCatalog = {
        light: {
            label: "Light"
        },
        dark: {
            label: "Dark"
        }
    };

    function textValue(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function isSupportedTheme(theme) {
        return Object.prototype.hasOwnProperty.call(themeCatalog, textValue(theme));
    }

    function normalizeTheme(theme) {
        const nextTheme = textValue(theme);

        return isSupportedTheme(nextTheme) ? nextTheme : fallbackTheme;
    }

    function readStoredTheme() {
        try {
            return normalizeTheme(localStorage.getItem(themeStorageKey));
        } catch (error) {
            return fallbackTheme;
        }
    }

    function persistTheme(theme) {
        try {
            localStorage.setItem(themeStorageKey, normalizeTheme(theme));
        } catch (error) {
            return;
        }
    }

    function readActiveTheme() {
        return normalizeTheme(document.documentElement.dataset.theme);
    }

    function syncThemeButtons(root, theme) {
        const nextTheme = normalizeTheme(theme);

        root.querySelectorAll("[data-theme-option]").forEach((button) => {
            button.setAttribute("aria-pressed", String(button.dataset.themeOption === nextTheme));
        });
    }

    function applyTheme(theme, options = {}) {
        const nextTheme = normalizeTheme(theme);
        const root = options.root || document;

        document.documentElement.dataset.theme = nextTheme;
        syncThemeButtons(root, nextTheme);

        if (options.persist) {
            persistTheme(nextTheme);
        }

        return nextTheme;
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
        readActiveTheme,
        syncThemeButtons,
        applyTheme,
        bootstrapTheme
    };
})();
