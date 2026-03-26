(function () {
    const submitService = window.WayokiThemeSubmit || null;
    const editorConfig = window.WayokiThemeEditorConfig || null;
    const themeRuntime = window.WayokiThemeSwitcher || null;
    const draftStorageKey = "wayoki-theme-editor-draft-v1";
    const draftStorageVersion = 1;
    const editorHeightStorageKey = "wayoki-theme-editor-height-v1";
    const editorHeightMin = 180;
    const editorHeightMax = 560;
    const editorHeightDefault = 300;
    const submitSuccessNoticeDurationMs = 2800;
    const submitSuccessRedirectDelayMs = 3000;

    if (!submitService || !editorConfig || !Array.isArray(editorConfig.sections) || !editorConfig.sections.length) {
        return;
    }

    const uiText = {
        ru: {
            panelTitle: "Режим кастомизации",
            themeName: "Имя темы",
            themeNamePlaceholder: "noir-soft",
            authorName: "Имя автора",
            authorNamePlaceholder: "alex",
            authorLink: "Ссылка автора",
            authorLinkPlaceholder: "t.me/instagram.com",
            reset: "Сбросить",
            submit: "Отправить тему",
            submitNow: "Отправить",
            exit: "Выйти из кастомизации",
            resize: "Измени высоту панели",
            submitting: "Отправка...",
            submitted: "Отправлено",
            close: "Закрыть",
            requiredHint: "Поля со звёздочкой обязательны.",
            noChanges: "Измените визуальные токены, чтобы подготовить тему к отправке.",
            invalidField: "Проверьте значения визуальных токенов.",
            resetSuccess: "Черновик очищен, превью сброшено к базовой теме.",
            submitCreated: "Тема отправлена как новая.",
            submitUpdated: "Тема обновлена.",
            submitSuccess: "Тема отправлена.",
            submitNotice: "Настройки сохранены, ожидайте публикации",
            submitFailed: "Не удалось отправить тему",
            submitUnavailableLocal: "Сабмит недоступен в локальном режиме. Проверь CORS или используй продовый домен.",
            submitModalTitle: "Отправка темы",
            submitModalDescription: "Имя темы, имя автора и ссылка автора запрашиваются только на этом шаге.",
            themeNameRequired: "Имя темы *",
            authorNameRequired: "Имя автора *",
            authorLinkOptional: "Ссылка автора",
            colorPicker: "Открыть выбор цвета",
            previewJump: "Показать на странице",
            hue: "Оттенок",
            alpha: "Прозрачность",
            saturation: "Цвет"
        },
        en: {
            panelTitle: "Customization mode",
            themeName: "Theme name",
            themeNamePlaceholder: "noir-soft",
            authorName: "Author name",
            authorNamePlaceholder: "alex",
            authorLink: "Author link",
            authorLinkPlaceholder: "t.me/instagram.com",
            reset: "Reset",
            submit: "Submit theme",
            submitNow: "Submit",
            exit: "Exit customization",
            resize: "Resize panel",
            submitting: "Submitting...",
            submitted: "Submitted",
            close: "Close",
            requiredHint: "Fields marked with an asterisk are required.",
            noChanges: "Adjust the visual tokens before submitting a theme.",
            invalidField: "Please check the visual token values.",
            resetSuccess: "Draft cleared and preview reset to the base theme.",
            submitCreated: "Theme created.",
            submitUpdated: "Theme updated.",
            submitSuccess: "Theme submitted.",
            submitNotice: "Settings saved. Please wait for publication",
            submitFailed: "Failed to submit theme",
            submitUnavailableLocal: "Submit is unavailable in local mode. Check CORS or use the production domain.",
            submitModalTitle: "Submit theme",
            submitModalDescription: "Theme name, author name and author link are only requested at this final step.",
            themeNameRequired: "Theme name *",
            authorNameRequired: "Author name *",
            authorLinkOptional: "Author link",
            colorPicker: "Open color picker",
            previewJump: "Show on page",
            hue: "Hue",
            alpha: "Opacity",
            saturation: "Color"
        }
    };

    function textValue(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function getLocale() {
        return typeof submitService.detectLocale === "function" ? submitService.detectLocale() : "en";
    }

    function getLabels(locale) {
        return uiText[locale === "ru" ? "ru" : "en"];
    }

    function getLocalizedText(value, locale) {
        if (typeof value === "string") {
            return value;
        }

        if (!value || typeof value !== "object") {
            return "";
        }

        return textValue(value[locale]) || textValue(value.en) || textValue(value.ru);
    }

    function getCurrentEditorHeightMax() {
        return clamp(window.innerHeight - 180, editorHeightMin, editorHeightMax);
    }

    function getStoredEditorHeight() {
        try {
            const value = Number(window.localStorage.getItem(editorHeightStorageKey));

            return Number.isFinite(value) ? clamp(value, editorHeightMin, getCurrentEditorHeightMax()) : editorHeightDefault;
        } catch (error) {
            return editorHeightDefault;
        }
    }

    function persistEditorHeight(value) {
        try {
            window.localStorage.setItem(editorHeightStorageKey, String(clamp(value, editorHeightMin, getCurrentEditorHeightMax())));
        } catch (error) {
            return;
        }
    }

    function getEditableTokenNames() {
        const tokenNames = [];

        editorConfig.sections.forEach((sectionConfig) => {
            (sectionConfig.fields || []).forEach((fieldConfig) => {
                tokenNames.push(fieldConfig.token);
            });
        });

        return tokenNames;
    }

    function createElement(tagName, className, textContent) {
        const element = document.createElement(tagName);

        if (className) {
            element.className = className;
        }

        if (typeof textContent === "string") {
            element.textContent = textContent;
        }

        return element;
    }

    function supportsCss(propertyName, value) {
        if (!textValue(value)) {
            return false;
        }

        if (!window.CSS || typeof window.CSS.supports !== "function") {
            return true;
        }

        return window.CSS.supports(propertyName, value);
    }

    function isValidFieldValue(field, value) {
        const nextValue = textValue(value);

        if (!nextValue) {
            return true;
        }

        switch (field.cssType) {
            case "color":
                return supportsCss("color", nextValue);
            case "shadow":
                return supportsCss("box-shadow", nextValue);
            case "length":
                return supportsCss("font-size", nextValue);
            case "scheme":
                return nextValue === "light" || nextValue === "dark";
            default:
                return true;
        }
    }

    function isColorField(field) {
        return field.cssType === "color";
    }

    function getComputedTokenValue(tokenName) {
        return textValue(window.getComputedStyle(document.documentElement).getPropertyValue(tokenName));
    }

    function cloneTokens(tokens) {
        return Object.keys(tokens || {}).reduce((result, key) => {
            result[key] = textValue(tokens[key]);
            return result;
        }, {});
    }

    function cloneDraft(draft) {
        return {
            baseTheme: textValue(draft && draft.baseTheme),
            themeName: textValue(draft && draft.themeName),
            authorName: textValue(draft && draft.authorName),
            authorLink: textValue(draft && draft.authorLink),
            creditText: textValue(draft && draft.creditText),
            tokens: cloneTokens((draft && draft.tokens) || {})
        };
    }

    function draftToComparableObject(state, draft) {
        const comparableTokens = {};

        state.fieldEntries.forEach((entry) => {
            comparableTokens[entry.config.token] = textValue(draft.tokens[entry.config.token]);
        });

        return {
            baseTheme: textValue(draft.baseTheme),
            tokens: comparableTokens
        };
    }

    function areDraftsEqual(state, leftDraft, rightDraft) {
        return JSON.stringify(draftToComparableObject(state, leftDraft)) === JSON.stringify(draftToComparableObject(state, rightDraft));
    }

    function closeThemeMenu() {
        const themeMenu = document.querySelector("[data-theme-menu]");
        const themeMenuToggle = document.querySelector("[data-theme-menu-toggle]");

        if (!themeMenu || !themeMenuToggle) {
            return;
        }

        themeMenu.hidden = true;
        themeMenuToggle.setAttribute("aria-expanded", "false");
    }

    function getBaseCreditText() {
        return typeof submitService.readThemeCredit === "function"
            ? submitService.readThemeCredit(submitService.getCurrentTheme())
            : "";
    }

    function getBaseCreditLink() {
        return typeof submitService.readThemeAuthorLink === "function"
            ? submitService.readThemeAuthorLink(submitService.getCurrentTheme())
            : "";
    }

    function buildCreditText(authorName) {
        const nextAuthorName = textValue(authorName);

        return nextAuthorName ? `by: ${nextAuthorName}` : "";
    }

    function syncCreditElements(value, authorLink) {
        const nextValue = textValue(value);
        const nextAuthorLink =
            typeof submitService.normalizeAuthorLink === "function"
                ? submitService.normalizeAuthorLink(authorLink)
                : textValue(authorLink);

        document.querySelectorAll("[data-theme-credit]").forEach((element) => {
            element.hidden = !nextValue;

            if (!nextValue) {
                element.textContent = "";
                return;
            }

            if (!nextAuthorLink) {
                element.textContent = nextValue;
                return;
            }

            const link = document.createElement("a");

            link.className = "brand-credit-link";
            link.href = nextAuthorLink;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = nextValue;
            element.replaceChildren(link);
        });
    }

    function isLocalDevelopmentOrigin() {
        const hostName = textValue(window.location.hostname).toLowerCase();

        return (
            hostName === "localhost" ||
            hostName === "127.0.0.1" ||
            hostName === "::1" ||
            hostName === "[::1]"
        );
    }

    function normalizeSubmitErrorMessage(state, error) {
        const errorCode = textValue(error && error.result && error.result.data && error.result.data.code);
        const resultMessage = textValue(error && error.result && error.result.message);
        const errorMessage = textValue(error && error.message);
        const rawMessage = resultMessage || errorMessage;
        const loweredMessage = rawMessage.toLowerCase();
        const localizedCodeMessages = state.locale === "ru"
            ? {
                  invalid_theme_name: "Укажите имя темы.",
                  invalid_author_name: "Укажите имя автора.",
                  invalid_author_link: "Укажите корректную ссылку автора.",
                  invalid_theme_slug: "Имя темы должно содержать хотя бы одну букву или цифру после нормализации.",
                  invalid_author_slug: "Имя автора должно содержать хотя бы одну букву или цифру после нормализации.",
                  invalid_tokens: "Не удалось собрать редактируемые токены темы.",
                  invalid_endpoint: "Некорректный submit endpoint для отправки темы.",
                  branch_create_failed: "Не удалось создать рабочую ветку для отправки темы.",
                  submission_write_failed: "Не удалось сохранить submission-файл темы.",
                  legacy_cleanup_failed: "Не удалось убрать устаревший submission-файл.",
                  registry_read_failed: "Не удалось прочитать registry кастомных тем.",
                  registry_build_failed: "Не удалось пересобрать registry кастомных тем.",
                  registry_write_failed: "Не удалось обновить registry кастомных тем.",
                  pull_request_failed: "Не удалось создать pull request для темы."
              }
            : {
                  invalid_theme_name: "Please provide a theme name.",
                  invalid_author_name: "Please provide an author name.",
                  invalid_author_link: "Please provide a valid author link.",
                  invalid_theme_slug: "Theme name must contain at least one letter or digit after normalization.",
                  invalid_author_slug: "Author name must contain at least one letter or digit after normalization.",
                  invalid_tokens: "Couldn't collect editable tokens.",
                  invalid_endpoint: "The theme submit endpoint is invalid.",
                  branch_create_failed: "Failed to create a working branch for the theme submission.",
                  submission_write_failed: "Failed to save the theme submission file.",
                  legacy_cleanup_failed: "Failed to remove an obsolete legacy submission file.",
                  registry_read_failed: "Failed to read the custom theme registry.",
                  registry_build_failed: "Failed to rebuild the custom theme registry.",
                  registry_write_failed: "Failed to update the custom theme registry.",
                  pull_request_failed: "Failed to create a pull request for the theme."
              };

        if (isLocalDevelopmentOrigin() && (!rawMessage || loweredMessage.includes("failed to fetch") || loweredMessage.includes("networkerror"))) {
            return state.labels.submitUnavailableLocal;
        }

        if (loweredMessage === "failed to fetch" || loweredMessage.includes("load failed")) {
            return state.labels.submitFailed;
        }

        if (error && error.name === "AbortError") {
            return state.labels.submitFailed;
        }

        if (errorCode && localizedCodeMessages[errorCode]) {
            return localizedCodeMessages[errorCode];
        }

        return rawMessage || state.labels.submitFailed;
    }

    function toChannelLuminance(channel) {
        const normalized = clamp(channel / 255, 0, 1);

        if (normalized <= 0.03928) {
            return normalized / 12.92;
        }

        return ((normalized + 0.055) / 1.055) ** 2.4;
    }

    function getRelativeLuminance(color) {
        return (
            0.2126 * toChannelLuminance(color.r) +
            0.7152 * toChannelLuminance(color.g) +
            0.0722 * toChannelLuminance(color.b)
        );
    }

    function getDerivedColorSchemeFromTokens(tokenMap, fallbackBackgroundValue) {
        const backgroundColor = parseCssColor((tokenMap && tokenMap["--color-bg"]) || fallbackBackgroundValue || "");

        if (!backgroundColor) {
            return "light";
        }

        return getRelativeLuminance(backgroundColor) < 0.34 ? "dark" : "light";
    }

    function getDerivedColorScheme(state, draft) {
        const draftTokens = draft && draft.tokens ? draft.tokens : {};

        return getDerivedColorSchemeFromTokens(
            draftTokens,
            (state.baseSnapshot.tokens && state.baseSnapshot.tokens["--color-bg"]) || ""
        );
    }

    function getPreviewTargetsForToken(tokenName) {
        const tokenTargets = {
            "--color-bg": {
                selectors: [".site-header", ".feature-section", ".page-main"],
                scrollTop: true
            },
            "--color-bg-secondary": {
                selectors: [".news-section", ".site-footer", ".site-header"]
            },
            "--color-bg-tertiary": {
                selectors: [".page-main", ".news-section"]
            },
            "--color-surface": {
                selectors: [".theme-menu", ".quick-search-dropdown"]
            },
            "--color-surface-strong": {
                selectors: [".theme-menu", ".quick-search-dropdown", ".news-feature"]
            },
            "--color-surface-elevated": {
                selectors: [".quick-search-dropdown", ".feature-plaque"]
            },
            "--color-card": {
                selectors: [".news-item", ".footer-icon-link", ".news-modal-close"]
            },
            "--color-card-strong": {
                selectors: [".news-feature", ".theme-menu"]
            },
            "--color-chip": {
                selectors: [".quick-search", ".footer-icon-link", ".news-modal-close"]
            },
            "--color-chip-hover": {
                selectors: [".quick-search", ".footer-icon-link", ".news-modal-close"]
            },
            "--color-toggle-active": {
                selectors: [
                    ".locale-link[aria-current=\"page\"]",
                    ".theme-menu-toggle",
                    ".theme-button[aria-pressed=\"true\"]",
                    ".theme-button-option-group"
                ]
            },
            "--color-text-primary": {
                selectors: [".brand", ".game-title-latin", ".section-title", ".news-feature-title"]
            },
            "--color-text-secondary": {
                selectors: [".feature-copy", ".news-feature-preview", ".news-preview", ".news-modal-body"]
            },
            "--color-text-muted": {
                selectors: [".brand-credit", ".section-label", ".news-note", ".news-date", ".footer-label", ".footer-divider"]
            },
            "--color-border": {
                selectors: [".site-header", ".theme-menu", ".feature-plaque", ".news-item", ".news-feature", ".footer-icon-link"]
            },
            "--color-border-strong": {
                selectors: [".archive-link", ".news-link", ".footer-text-link", ".news-modal-close", ".footer-icon-link"]
            },
            "--color-border-inset": {
                selectors: [".feature-plaque", ".news-feature", ".news-item"]
            },
            "--color-link": {
                selectors: [".archive-link", ".news-link", ".footer-text-link", ".footer-icon-link"]
            },
            "--color-link-hover": {
                selectors: [".archive-link", ".news-link", ".footer-text-link", ".footer-icon-link", ".news-title-link"]
            },
            "--color-accent": {
                selectors: [".news-expand-button", ".archive-link", ".news-link", ".footer-icon-link"]
            },
            "--color-accent-hover": {
                selectors: [".archive-link", ".news-link", ".footer-icon-link", ".news-title-link", ".news-expand-button"]
            },
            "--color-bg-highlight": {
                selectors: [".feature-section", ".feature-plaque", ".page-main"]
            },
            "--color-bg-glow": {
                selectors: [".feature-section", ".feature-plaque", ".page-main"]
            },
            "--color-bg-accent": {
                selectors: [".feature-section", ".feature-plaque", ".page-main"]
            },
            "--color-overlay": {
                selectors: [".news-modal", ".news-section"]
            },
            "--shadow-soft": {
                selectors: [".news-item", ".footer-icon-link"]
            },
            "--shadow-medium": {
                selectors: [".news-feature", ".quick-search", ".theme-menu"]
            },
            "--shadow-large": {
                selectors: [".feature-plaque", ".news-modal-dialog"]
            },
            "--feature-plaque-shadow": {
                selectors: [".feature-plaque"]
            }
        };

        return tokenTargets[tokenName] || null;
    }

    function applyStoredDraftPreview() {
        const storedRecord = readStoredDraftRecord();

        if (!storedRecord || !storedRecord.current || typeof storedRecord.current !== "object") {
            return null;
        }

        const draft = storedRecord.current;
        const tokenMap = draft.tokens && typeof draft.tokens === "object" ? draft.tokens : {};
        const themeName = textValue(draft.baseTheme);

        if (themeName && themeRuntime && typeof themeRuntime.applyTheme === "function") {
            themeRuntime.applyTheme(themeName);
        }

        getEditableTokenNames().forEach((tokenName) => {
            const tokenValue = textValue(tokenMap[tokenName]);

            if (tokenValue) {
                document.documentElement.style.setProperty(tokenName, tokenValue);
                return;
            }

            document.documentElement.style.removeProperty(tokenName);
        });

        document.documentElement.style.setProperty(
            "--theme-color-scheme",
            getDerivedColorSchemeFromTokens(tokenMap, window.getComputedStyle(document.documentElement).getPropertyValue("--color-bg"))
        );

        syncCreditElements(textValue(draft.creditText) || buildCreditText(textValue(draft.authorName)), textValue(draft.authorLink));
        return draft;
    }

    function withClearedTokenOverrides(state, callback) {
        const previousValues = new Map();
        const schemeToken = "--theme-color-scheme";

        state.fieldEntries.forEach((entry) => {
            previousValues.set(entry.config.token, document.documentElement.style.getPropertyValue(entry.config.token));
            document.documentElement.style.removeProperty(entry.config.token);
        });

        previousValues.set(schemeToken, document.documentElement.style.getPropertyValue(schemeToken));
        document.documentElement.style.removeProperty(schemeToken);

        try {
            return callback();
        } finally {
            previousValues.forEach((value, tokenName) => {
                if (textValue(value)) {
                    document.documentElement.style.setProperty(tokenName, value);
                    return;
                }

                document.documentElement.style.removeProperty(tokenName);
            });
        }
    }

    function captureBaseSnapshot(state) {
        const tokens = withClearedTokenOverrides(state, () => {
            const values = {};

            state.fieldEntries.forEach((entry) => {
                values[entry.config.token] = getComputedTokenValue(entry.config.token);
            });

            return values;
        });

        state.baseSnapshot = {
            theme: submitService.getCurrentTheme(),
            tokens,
            creditText: getBaseCreditText(),
            authorLink: getBaseCreditLink()
        };

        if (state.baseThemeValue) {
            state.baseThemeValue.textContent = state.baseSnapshot.theme;
        }
    }

    function buildBaseDraft(state) {
        const tokens = {};

        state.fieldEntries.forEach((entry) => {
            tokens[entry.config.token] = textValue(state.baseSnapshot.tokens[entry.config.token]);
        });

        return {
            baseTheme: textValue(state.baseSnapshot.theme),
            themeName: "",
            authorName: "",
            authorLink: "",
            creditText: "",
            tokens
        };
    }

    function normalizeDraftTokens(state, sourceTokens, fallbackTokens) {
        const nextTokens = {};

        state.fieldEntries.forEach((entry) => {
            const tokenName = entry.config.token;
            const sourceValue = sourceTokens && typeof sourceTokens === "object" ? textValue(sourceTokens[tokenName]) : "";
            const fallbackValue = fallbackTokens && typeof fallbackTokens === "object" ? textValue(fallbackTokens[tokenName]) : "";

            nextTokens[tokenName] = sourceValue || fallbackValue || textValue(state.baseSnapshot.tokens[tokenName]);
        });

        return nextTokens;
    }

    function buildDraftFromSource(state, sourceDraft, fallbackDraft) {
        const fallback = cloneDraft(fallbackDraft);

        if (!sourceDraft || typeof sourceDraft !== "object" || Array.isArray(sourceDraft)) {
            return fallback;
        }

        return {
            baseTheme: textValue(sourceDraft.baseTheme) || fallback.baseTheme || textValue(state.baseSnapshot.theme),
            themeName: textValue(sourceDraft.themeName),
            authorName: textValue(sourceDraft.authorName),
            authorLink: textValue(sourceDraft.authorLink) || textValue(fallback.authorLink),
            creditText:
                typeof sourceDraft.creditText === "string"
                    ? textValue(sourceDraft.creditText)
                    : buildCreditText(textValue(sourceDraft.authorName)) ||
                      fallback.creditText ||
                      buildCreditText(textValue(fallback.authorName)),
            tokens: normalizeDraftTokens(state, sourceDraft.tokens, fallback.tokens)
        };
    }

    function readStoredDraftRecord() {
        try {
            const rawValue = window.localStorage.getItem(draftStorageKey);

            if (!rawValue) {
                return null;
            }

            const parsedValue = JSON.parse(rawValue);

            if (!parsedValue || parsedValue.version !== draftStorageVersion) {
                return null;
            }

            return parsedValue;
        } catch (error) {
            return null;
        }
    }

    function persistDraftRecord(state) {
        try {
            window.localStorage.setItem(
                draftStorageKey,
                JSON.stringify({
                    version: draftStorageVersion,
                    baseline: cloneDraft(state.baselineDraft),
                    current: cloneDraft(state.currentDraft),
                    savedAt: new Date().toISOString()
                })
            );
        } catch (error) {
            return;
        }
    }

    function clearDraftRecord() {
        try {
            window.localStorage.removeItem(draftStorageKey);
        } catch (error) {
            return;
        }
    }

    function updateSwatch(entry, value) {
        if (!entry.swatch) {
            return;
        }

        const nextValue = textValue(value);

        if (nextValue && supportsCss("color", nextValue)) {
            entry.swatch.style.background = nextValue;
            entry.swatch.hidden = false;
            return;
        }

        entry.swatch.style.background = "transparent";
        entry.swatch.hidden = true;
    }

    function setFieldInputValue(entry, value) {
        const nextValue = textValue(value);

        entry.input.value = nextValue;
        entry.input.setAttribute("aria-invalid", "false");
        updateSwatch(entry, nextValue);
    }

    function readDraftFromPreview(state) {
        const tokens = {};

        state.fieldEntries.forEach((entry) => {
            const tokenName = entry.config.token;

            tokens[tokenName] = getComputedTokenValue(tokenName) || textValue(state.baseSnapshot.tokens[tokenName]);
        });

        return {
            baseTheme: textValue(submitService.getCurrentTheme()),
            themeName: textValue(state.currentDraft && state.currentDraft.themeName),
            authorName: textValue(state.currentDraft && state.currentDraft.authorName),
            authorLink: textValue(state.currentDraft && state.currentDraft.authorLink),
            creditText: textValue(state.currentDraft && state.currentDraft.creditText),
            tokens
        };
    }

    function applyDraftToPreview(state, nextDraft, options = {}) {
        const normalizedDraft = buildDraftFromSource(
            state,
            nextDraft,
            state.currentDraft || state.baselineDraft || buildBaseDraft(state)
        );

        state.isApplyingDraft = true;
        state.currentDraft = cloneDraft(normalizedDraft);
        state.currentDraft.baseTheme = textValue(state.baseSnapshot.theme);

        state.fieldEntries.forEach((entry) => {
            const tokenName = entry.config.token;
            const tokenValue = textValue(state.currentDraft.tokens[tokenName]) || textValue(state.baseSnapshot.tokens[tokenName]);
            const baseValue = textValue(state.baseSnapshot.tokens[tokenName]);

            if (tokenValue && tokenValue !== baseValue) {
                document.documentElement.style.setProperty(tokenName, tokenValue);
            } else {
                document.documentElement.style.removeProperty(tokenName);
            }

            setFieldInputValue(entry, tokenValue || baseValue);
            state.currentDraft.tokens[tokenName] = tokenValue || baseValue;
        });

        document.documentElement.style.setProperty("--theme-color-scheme", getDerivedColorScheme(state, state.currentDraft));
        syncCreditElements(
            textValue(state.currentDraft.creditText) || textValue(state.baseSnapshot.creditText),
            textValue(state.currentDraft.authorLink) || textValue(state.baseSnapshot.authorLink)
        );
        state.isApplyingDraft = false;

        if (!options.silent) {
            persistDraftRecord(state);
            updateButtonState(state);
        }
    }

    function setStatus(state, kind, message) {
        state.status.hidden = !message;
        state.status.textContent = message || "";
        state.status.dataset.status = message ? kind : "";

        if (state.statusRow) {
            state.statusRow.hidden = !message;
        }
    }

    function clearToast(state) {
        if (!state.toast) {
            return;
        }

        if (state.toastTimeout) {
            window.clearTimeout(state.toastTimeout);
            state.toastTimeout = 0;
        }

        state.toast.dataset.visible = "false";
        state.toast.dataset.status = "";

        if (state.toastHideTimeout) {
            window.clearTimeout(state.toastHideTimeout);
            state.toastHideTimeout = 0;
        }

        state.toastHideTimeout = window.setTimeout(() => {
            state.toast.hidden = true;
        }, 180);

        if (state.toastMessage) {
            state.toastMessage.textContent = "";
        }
    }

    function showToast(state, kind, message, options = {}) {
        if (!state.toast || !textValue(message)) {
            return;
        }

        clearToast(state);
        state.toast.hidden = false;
        state.toast.dataset.status = kind;
        if (state.toastMessage) {
            state.toastMessage.textContent = message;
        }
        window.requestAnimationFrame(() => {
            state.toast.dataset.visible = "true";
        });

        if (options.duration && Number(options.duration) > 0) {
            state.toastTimeout = window.setTimeout(() => {
                clearToast(state);
            }, Number(options.duration));
        }
    }

    function createSuccessToastIcon() {
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

        icon.setAttribute("viewBox", "0 0 24 24");
        icon.setAttribute("aria-hidden", "true");
        icon.setAttribute("focusable", "false");
        icon.classList.add("theme-editor-toast-icon-svg");

        circle.setAttribute("cx", "12");
        circle.setAttribute("cy", "12");
        circle.setAttribute("r", "9");

        path.setAttribute("d", "M7.6 12.3 10.5 15.2 16.5 9.2");

        icon.append(circle, path);
        return icon;
    }

    function hasInvalidTokenFields(state) {
        return state.fieldEntries.some((entry) => entry.input.getAttribute("aria-invalid") === "true");
    }

    function buildPayload(state) {
        const authorName = textValue(state.currentDraft.authorName);
        const authorLink = textValue(state.currentDraft.authorLink);
        const creditText = buildCreditText(authorName);
        const tokens = cloneTokens(state.currentDraft.tokens);

        state.currentDraft.creditText = creditText;
        tokens["--theme-color-scheme"] = getDerivedColorScheme(state, state.currentDraft);

        return submitService.createThemePayload({
            themeName: state.currentDraft.themeName,
            authorName,
            authorLink,
            creditText,
            sourceTheme: state.currentDraft.baseTheme,
            tokens
        });
    }

    function validateEditorPayload(state, payload) {
        const baseValidationError = submitService.validateThemePayload(payload, state.locale);

        if (baseValidationError) {
            return baseValidationError;
        }

        if (hasInvalidTokenFields(state)) {
            return state.labels.invalidField;
        }

        return "";
    }

    function updateButtonState(state) {
        const invalidTokenFields = hasInvalidTokenFields(state);

        state.isDirty = !areDraftsEqual(state, state.currentDraft, state.baselineDraft);
        state.submitButton.disabled = !state.isDirty || invalidTokenFields || state.submitting;
        state.submitButton.title = !state.isDirty ? state.labels.noChanges : invalidTokenFields ? state.labels.invalidField : "";

        if (typeof state.updateSubmitModalState === "function") {
            state.updateSubmitModalState();
        }
    }

    function finalizeTokenState(state) {
        persistDraftRecord(state);
        updateButtonState(state);
    }

    function clearPreviewHighlight(state) {
        if (!state.previewHighlightTargets || !state.previewHighlightTargets.length) {
            return;
        }

        state.previewHighlightTargets.forEach((element) => {
            element.classList.remove("theme-editor-target-highlight");
        });

        state.previewHighlightTargets = [];

        if (state.previewHighlightTimeout) {
            window.clearTimeout(state.previewHighlightTimeout);
            state.previewHighlightTimeout = 0;
        }
    }

    function getPanelOffsetHeight(state) {
        const panelHeight = state.root ? state.root.getBoundingClientRect().height : 0;

        return Math.max(panelHeight + 20, 120);
    }

    function scrollPreviewElementIntoView(state, element) {
        if (!element) {
            return;
        }

        const targetTop = Math.max(window.scrollY + element.getBoundingClientRect().top - getPanelOffsetHeight(state), 0);

        window.scrollTo({
            top: targetTop,
            behavior: "smooth"
        });
    }

    function focusPreviewTarget(state, field) {
        const previewTarget = getPreviewTargetsForToken(field.token);

        if (!previewTarget) {
            return;
        }

        clearPreviewHighlight(state);

        const matches = [];

        previewTarget.selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((element) => {
                if (matches.includes(element)) {
                    return;
                }

                matches.push(element);
            });
        });

        const primaryTarget = matches[0] || null;

        if (previewTarget.scrollTop) {
            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        } else if (primaryTarget) {
            scrollPreviewElementIntoView(state, primaryTarget);
        }

        matches.slice(0, 4).forEach((element) => {
            element.classList.add("theme-editor-target-highlight");
        });

        state.previewHighlightTargets = matches.slice(0, 4);
        state.previewHighlightTimeout = window.setTimeout(() => {
            clearPreviewHighlight(state);
        }, 1600);
    }

    function applyFieldValue(state, entry, options = {}) {
        const rawValue = textValue(entry.input.value);
        const tokenName = entry.config.token;
        const baseValue = textValue(state.baseSnapshot.tokens[tokenName]);

        if (!rawValue) {
            document.documentElement.style.removeProperty(tokenName);
            state.currentDraft.tokens[tokenName] = baseValue;
            setFieldInputValue(entry, baseValue);

            if (state.colorPicker.entry === entry && !options.skipPickerSync) {
                syncColorPickerFromValue(state, baseValue);
            }

            finalizeTokenState(state);
            return true;
        }

        if (!isValidFieldValue(entry.config, rawValue)) {
            entry.input.setAttribute("aria-invalid", "true");

            if (options.commit) {
                setFieldInputValue(entry, state.currentDraft.tokens[tokenName] || baseValue);
            }

            updateButtonState(state);
            return false;
        }

        entry.input.setAttribute("aria-invalid", "false");
        document.documentElement.style.setProperty(tokenName, rawValue);

        let normalizedValue = getComputedTokenValue(tokenName) || rawValue;

        if (normalizedValue === baseValue) {
            document.documentElement.style.removeProperty(tokenName);
            normalizedValue = baseValue;
        }

        state.currentDraft.tokens[tokenName] = normalizedValue;
        setFieldInputValue(entry, normalizedValue);

        if (state.colorPicker.entry === entry && !options.skipPickerSync) {
            syncColorPickerFromValue(state, normalizedValue);
        }

        finalizeTokenState(state);
        return true;
    }

    function resetPreview(state) {
        captureBaseSnapshot(state);

        state.baselineDraft = buildBaseDraft(state);
        state.currentDraft = cloneDraft(state.baselineDraft);
        state.submitModalThemeTouched = false;
        state.submitModalAuthorTouched = false;
        state.submitting = false;
        state.submitButton.textContent = state.labels.submit;
        applyDraftToPreview(state, state.currentDraft, {
            silent: true
        });
        clearDraftRecord();
        closeColorPicker(state);
        closeSubmitModal(state);
        clearPreviewHighlight(state);
        clearToast(state);
        if (state.submitModalButton) {
            state.submitModalButton.textContent = state.labels.submitNow;
        }
        setStatus(state, "success", state.labels.resetSuccess);
        updateButtonState(state);
    }

    function clamp(value, minValue, maxValue) {
        return Math.min(Math.max(value, minValue), maxValue);
    }

    function parseCssColor(value) {
        const nextValue = textValue(value);

        if (!nextValue) {
            return null;
        }

        const probe = document.createElement("span");

        probe.style.position = "fixed";
        probe.style.opacity = "0";
        probe.style.pointerEvents = "none";
        probe.style.color = nextValue;

        if (!probe.style.color) {
            return null;
        }

        document.body.append(probe);

        const computedValue = window.getComputedStyle(probe).color;

        probe.remove();

        const parts = computedValue.match(/[\d.]+/g);

        if (!parts || parts.length < 3) {
            return null;
        }

        return {
            r: clamp(Math.round(Number(parts[0])), 0, 255),
            g: clamp(Math.round(Number(parts[1])), 0, 255),
            b: clamp(Math.round(Number(parts[2])), 0, 255),
            a: parts[3] !== undefined ? clamp(Number(parts[3]), 0, 1) : 1
        };
    }

    function rgbToHsv(color) {
        const r = color.r / 255;
        const g = color.g / 255;
        const b = color.b / 255;
        const maxValue = Math.max(r, g, b);
        const minValue = Math.min(r, g, b);
        const delta = maxValue - minValue;
        let hue = 0;

        if (delta > 0) {
            if (maxValue === r) {
                hue = ((g - b) / delta) % 6;
            } else if (maxValue === g) {
                hue = (b - r) / delta + 2;
            } else {
                hue = (r - g) / delta + 4;
            }
        }

        hue = Math.round(hue * 60);

        if (hue < 0) {
            hue += 360;
        }

        return {
            h: hue,
            s: maxValue === 0 ? 0 : delta / maxValue,
            v: maxValue,
            a: color.a
        };
    }

    function hsvToRgb(hsva) {
        const hue = ((hsva.h % 360) + 360) % 360;
        const saturation = clamp(hsva.s, 0, 1);
        const value = clamp(hsva.v, 0, 1);
        const chroma = value * saturation;
        const segment = hue / 60;
        const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
        const match = value - chroma;
        let red = 0;
        let green = 0;
        let blue = 0;

        if (segment >= 0 && segment < 1) {
            red = chroma;
            green = secondary;
        } else if (segment < 2) {
            red = secondary;
            green = chroma;
        } else if (segment < 3) {
            green = chroma;
            blue = secondary;
        } else if (segment < 4) {
            green = secondary;
            blue = chroma;
        } else if (segment < 5) {
            red = secondary;
            blue = chroma;
        } else {
            red = chroma;
            blue = secondary;
        }

        return {
            r: Math.round((red + match) * 255),
            g: Math.round((green + match) * 255),
            b: Math.round((blue + match) * 255),
            a: clamp(hsva.a, 0, 1)
        };
    }

    function rgbToCss(color) {
        const alpha = Math.round(color.a * 1000) / 1000;

        if (alpha >= 1) {
            return `rgb(${color.r}, ${color.g}, ${color.b})`;
        }

        return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
    }

    function syncColorPickerFromValue(state, value) {
        const parsedColor = parseCssColor(value) || {
            r: 0,
            g: 0,
            b: 0,
            a: 1
        };

        state.colorPicker.hsva = rgbToHsv(parsedColor);
        renderColorPicker(state);
    }

    function renderColorPicker(state) {
        if (!state.colorPicker.popover || !state.colorPicker.entry) {
            return;
        }

        const hsva = state.colorPicker.hsva;
        const color = hsvToRgb(hsva);
        const cssValue = rgbToCss(color);

        state.colorPicker.area.style.backgroundColor = `hsl(${Math.round(hsva.h)}, 100%, 50%)`;
        state.colorPicker.thumb.style.left = `${clamp(hsva.s, 0, 1) * 100}%`;
        state.colorPicker.thumb.style.top = `${(1 - clamp(hsva.v, 0, 1)) * 100}%`;
        state.colorPicker.hueInput.value = String(Math.round(hsva.h));
        state.colorPicker.alphaInput.value = String(Math.round(clamp(hsva.a, 0, 1) * 100));
        state.colorPicker.previewSwatch.style.background = cssValue;
        state.colorPicker.value.textContent = cssValue;
    }

    function positionColorPicker(state) {
        if (!state.colorPicker.entry || state.colorPicker.popover.hidden) {
            return;
        }

        const anchorRect = state.colorPicker.entry.control.getBoundingClientRect();
        const popover = state.colorPicker.popover;
        const viewportPadding = 12;
        const nextWidth = popover.offsetWidth;
        const nextHeight = popover.offsetHeight;
        let left = anchorRect.left;
        let top = anchorRect.bottom + 10;

        if (left + nextWidth > window.innerWidth - viewportPadding) {
            left = window.innerWidth - nextWidth - viewportPadding;
        }

        if (top + nextHeight > window.innerHeight - viewportPadding) {
            top = anchorRect.top - nextHeight - 10;
        }

        popover.style.left = `${clamp(left, viewportPadding, window.innerWidth - nextWidth - viewportPadding)}px`;
        popover.style.top = `${clamp(top, viewportPadding, window.innerHeight - nextHeight - viewportPadding)}px`;
    }

    function applyPickerColor(state) {
        if (!state.colorPicker.entry) {
            return;
        }

        const cssValue = rgbToCss(hsvToRgb(state.colorPicker.hsva));

        state.colorPicker.entry.input.value = cssValue;
        applyFieldValue(state, state.colorPicker.entry, {
            commit: true,
            skipPickerSync: true
        });
        renderColorPicker(state);
        positionColorPicker(state);
    }

    function closeColorPicker(state) {
        if (!state.colorPicker.popover) {
            return;
        }

        state.colorPicker.entry = null;
        state.colorPicker.popover.hidden = true;
    }

    function openColorPicker(state, entry) {
        if (!entry || !isColorField(entry.config)) {
            return;
        }

        state.colorPicker.entry = entry;
        state.colorPicker.popover.hidden = false;
        syncColorPickerFromValue(state, entry.input.value || state.currentDraft.tokens[entry.config.token]);
        positionColorPicker(state);
    }

    function buildColorPicker(state) {
        const popover = createElement("div", "theme-color-picker");
        const area = createElement("div", "theme-color-picker-area");
        const lightLayer = createElement("span", "theme-color-picker-area-light");
        const darkLayer = createElement("span", "theme-color-picker-area-dark");
        const thumb = createElement("span", "theme-color-picker-thumb");
        const hueRow = createElement("label", "theme-color-picker-row");
        const alphaRow = createElement("label", "theme-color-picker-row");
        const hueLabel = createElement("span", "theme-color-picker-label", state.labels.hue);
        const alphaLabel = createElement("span", "theme-color-picker-label", state.labels.alpha);
        const hueInput = createElement("input", "theme-color-picker-range");
        const alphaInput = createElement("input", "theme-color-picker-range");
        const preview = createElement("div", "theme-color-picker-preview");
        const previewSwatch = createElement("span", "theme-color-picker-preview-swatch");
        const previewValue = createElement("span", "theme-color-picker-preview-value");

        popover.hidden = true;
        area.append(lightLayer, darkLayer, thumb);

        hueInput.type = "range";
        hueInput.min = "0";
        hueInput.max = "360";
        hueInput.step = "1";

        alphaInput.type = "range";
        alphaInput.min = "0";
        alphaInput.max = "100";
        alphaInput.step = "1";

        hueRow.append(hueLabel, hueInput);
        alphaRow.append(alphaLabel, alphaInput);
        preview.append(previewSwatch, previewValue);
        popover.append(area, preview, hueRow, alphaRow);

        const updateFromPointer = (event) => {
            const rect = area.getBoundingClientRect();
            const saturation = clamp((event.clientX - rect.left) / rect.width, 0, 1);
            const brightness = 1 - clamp((event.clientY - rect.top) / rect.height, 0, 1);

            state.colorPicker.hsva.s = saturation;
            state.colorPicker.hsva.v = brightness;
            applyPickerColor(state);
        };

        area.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            updateFromPointer(event);

            const handleMove = (moveEvent) => {
                updateFromPointer(moveEvent);
            };

            const handleUp = () => {
                window.removeEventListener("pointermove", handleMove);
                window.removeEventListener("pointerup", handleUp);
            };

            window.addEventListener("pointermove", handleMove);
            window.addEventListener("pointerup", handleUp, {
                once: true
            });
        });

        hueInput.addEventListener("input", () => {
            state.colorPicker.hsva.h = Number(hueInput.value) || 0;
            applyPickerColor(state);
        });

        alphaInput.addEventListener("input", () => {
            state.colorPicker.hsva.a = clamp((Number(alphaInput.value) || 0) / 100, 0, 1);
            applyPickerColor(state);
        });

        document.addEventListener("pointerdown", (event) => {
            if (popover.hidden) {
                return;
            }

            if (popover.contains(event.target)) {
                return;
            }

            if (state.colorPicker.entry && state.colorPicker.entry.control.contains(event.target)) {
                return;
            }

            closeColorPicker(state);
        });

        window.addEventListener("resize", () => {
            if (!popover.hidden) {
                positionColorPicker(state);
            }
        });

        state.colorPicker = {
            popover,
            area,
            thumb,
            hueInput,
            alphaInput,
            previewSwatch,
            value: previewValue,
            entry: null,
            hsva: {
                h: 0,
                s: 1,
                v: 1,
                a: 1
            }
        };

        document.body.append(popover);
    }

    function createTokenField(state, field) {
        const fieldElement = createElement("label", "theme-editor-field");
        const heading = createElement("div", "theme-editor-field-heading");
        const labelText = getLocalizedText(field.label, state.locale) || field.token;
        const label = createElement("span", "theme-editor-field-label", labelText);
        const token = createElement("span", "theme-editor-field-token", field.token);
        const control = createElement("div", "theme-editor-control");
        const swatch = isColorField(field) ? createElement("button", "theme-editor-swatch") : null;
        let input;

        heading.append(label, token);

        if (field.kind === "select") {
            input = createElement("select", "theme-editor-input theme-editor-select");

            field.options.forEach((option) => {
                const optionElement = document.createElement("option");

                optionElement.value = option.value;
                optionElement.textContent = getLocalizedText(option.label, state.locale) || option.value;
                input.append(optionElement);
            });
        } else {
            input = createElement("input", "theme-editor-input");
            input.type = "text";
            input.autocomplete = "off";
            input.spellcheck = false;
        }

        input.name = field.token.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
        input.setAttribute("aria-invalid", "false");

        if (swatch) {
            swatch.type = "button";
            swatch.setAttribute("aria-label", `${state.labels.colorPicker}: ${labelText}`);
            swatch.hidden = true;
            control.append(swatch);
        }

        control.append(input);
        fieldElement.append(heading, control);

        const entry = {
            config: field,
            element: fieldElement,
            control,
            input,
            swatch
        };

        fieldElement.dataset.themeEditorToken = field.token;
        fieldElement.title = `${state.labels.previewJump}: ${labelText}`;

        if (field.kind === "select") {
            input.addEventListener("change", () => {
                if (state.isApplyingDraft) {
                    return;
                }

                applyFieldValue(state, entry, {
                    commit: true
                });
            });
        } else {
            input.addEventListener("input", () => {
                if (state.isApplyingDraft) {
                    return;
                }

                applyFieldValue(state, entry);
            });

            input.addEventListener("blur", () => {
                if (state.isApplyingDraft) {
                    return;
                }

                applyFieldValue(state, entry, {
                    commit: true
                });
            });
        }

        if (swatch) {
            swatch.addEventListener("click", (event) => {
                event.preventDefault();
                focusPreviewTarget(state, entry.config);
                openColorPicker(state, entry);
            });

            input.addEventListener("click", () => {
                focusPreviewTarget(state, entry.config);
                openColorPicker(state, entry);
            });
        }

        fieldElement.addEventListener("pointerdown", () => {
            focusPreviewTarget(state, entry.config);
        });

        input.addEventListener("focus", () => {
            focusPreviewTarget(state, entry.config);
        });

        return entry;
    }

    function createMetaField(labelText, placeholder, inputName) {
        const field = createElement("label", "theme-editor-field");
        const label = createElement("span", "theme-editor-field-label", labelText);
        const input = createElement("input", "theme-editor-input");

        input.type = "text";
        input.name = inputName;
        input.placeholder = placeholder;
        input.autocomplete = "off";
        input.spellcheck = false;
        input.setAttribute("aria-invalid", "false");

        field.append(label, input);
        return {
            field,
            input
        };
    }

    function setSubmitModalStatus(state, kind, message) {
        if (!state.submitModalStatus) {
            return;
        }

        state.submitModalStatus.hidden = !message;
        state.submitModalStatus.textContent = message || "";
        state.submitModalStatus.dataset.status = message ? kind : "";
    }

    function updateSubmitDraftField(state, fieldName, value) {
        state.currentDraft[fieldName] = textValue(value);

        if (fieldName === "authorName") {
            state.currentDraft.creditText = buildCreditText(state.currentDraft.authorName);
        }

        if (fieldName === "authorName" || fieldName === "authorLink") {
            syncCreditElements(
                textValue(state.currentDraft.creditText) || textValue(state.baseSnapshot.creditText),
                textValue(state.currentDraft.authorLink) || textValue(state.baseSnapshot.authorLink)
            );
        }

        persistDraftRecord(state);

        if (typeof state.updateSubmitModalState === "function") {
            state.updateSubmitModalState();
        }
    }

    function applyEditorHeight(state, heightValue) {
        const nextHeight = clamp(Number(heightValue) || editorHeightDefault, editorHeightMin, getCurrentEditorHeightMax());

        state.editorHeight = nextHeight;
        document.body.style.setProperty("--theme-editor-panel-height", `${nextHeight}px`);
    }

    function isCustomizationRoute() {
        const pathname = window.location.pathname.toLowerCase().replace(/\/+$/u, "");

        return pathname === "/ru/customization" || pathname === "/en/customization";
    }

    function getCustomizationExitHref(locale) {
        return locale === "ru" ? "/ru/" : "/en/";
    }

    function openSubmitModal(state) {
        if (!state.submitModal || !state.submitThemeInput || !state.submitAuthorInput || !state.submitAuthorLinkInput) {
            return;
        }

        state.submitModalThemeTouched = false;
        state.submitModalAuthorTouched = false;
        state.submitModalAuthorLinkTouched = false;
        state.submitThemeInput.value = textValue(state.currentDraft.themeName);
        state.submitAuthorInput.value = textValue(state.currentDraft.authorName);
        state.submitAuthorLinkInput.value = textValue(state.currentDraft.authorLink);
        state.submitModalButton.textContent = state.labels.submitNow;
        setSubmitModalStatus(state, "", "");
        state.submitModal.hidden = false;
        document.body.classList.add("theme-editor-submit-open");
        state.updateSubmitModalState();

        window.requestAnimationFrame(() => {
            state.submitThemeInput.focus();
            state.submitThemeInput.select();
        });
    }

    function closeSubmitModal(state) {
        if (!state.submitModal) {
            return;
        }

        state.submitModal.hidden = true;
        document.body.classList.remove("theme-editor-submit-open");
        setSubmitModalStatus(state, "", "");

        if (state.submitButton && !state.submitButton.disabled) {
            state.submitButton.focus();
            return;
        }

        if (state.resetButton) {
            state.resetButton.focus();
        }
    }

    function buildSubmitModal(state) {
        const overlay = createElement("div", "theme-editor-submit-modal");
        const dialog = createElement("div", "theme-editor-submit-dialog");
        const header = createElement("div", "theme-editor-submit-header");
        const headingGroup = createElement("div", "theme-editor-submit-heading-group");
        const title = createElement("h3", "theme-editor-submit-title", state.labels.submitModalTitle);
        const description = createElement("p", "theme-editor-submit-description", state.labels.submitModalDescription);
        const closeButton = createElement("button", "theme-button theme-editor-submit-close", state.labels.close);
        const note = createElement("p", "theme-editor-submit-note", state.labels.requiredHint);
        const fields = createElement("div", "theme-editor-submit-fields");
        const themeField = createMetaField(state.labels.themeNameRequired, state.labels.themeNamePlaceholder, "submit-theme-name");
        const authorField = createMetaField(state.labels.authorNameRequired, state.labels.authorNamePlaceholder, "submit-author-name");
        const authorLinkField = createMetaField(state.labels.authorLinkOptional, state.labels.authorLinkPlaceholder, "submit-author-link");
        const status = createElement("p", "theme-editor-status theme-editor-submit-status");
        const actions = createElement("div", "theme-editor-submit-actions");
        const confirmButton = createElement("button", "theme-button theme-editor-button theme-editor-button-primary", state.labels.submitNow);

        overlay.hidden = true;
        overlay.setAttribute("role", "presentation");
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute("aria-labelledby", "theme-editor-submit-title");
        title.id = "theme-editor-submit-title";
        closeButton.type = "button";
        confirmButton.type = "button";
        authorLinkField.input.type = "url";
        authorLinkField.input.inputMode = "url";
        authorLinkField.input.autocomplete = "url";
        status.hidden = true;
        status.setAttribute("aria-live", "polite");

        headingGroup.append(title, description);
        header.append(headingGroup, closeButton);
        fields.append(themeField.field, authorField.field, authorLinkField.field);
        actions.append(confirmButton);
        dialog.append(header, note, fields, status, actions);
        overlay.append(dialog);
        document.body.append(overlay);

        state.submitModal = overlay;
        state.submitModalDialog = dialog;
        state.submitThemeInput = themeField.input;
        state.submitAuthorInput = authorField.input;
        state.submitAuthorLinkInput = authorLinkField.input;
        state.submitModalStatus = status;
        state.submitModalButton = confirmButton;
        state.submitModalCloseButton = closeButton;

        state.updateSubmitModalState = () => {
            const payload = buildPayload(state);
            const validationError = validateEditorPayload(state, payload);

            state.submitThemeInput.setAttribute(
                "aria-invalid",
                String(Boolean(state.submitModalThemeTouched) && !textValue(state.currentDraft.themeName))
            );
            state.submitAuthorInput.setAttribute(
                "aria-invalid",
                String(Boolean(state.submitModalAuthorTouched) && !textValue(state.currentDraft.authorName))
            );
            state.submitAuthorLinkInput.setAttribute(
                "aria-invalid",
                String(
                    Boolean(state.submitModalAuthorLinkTouched) &&
                        Boolean(textValue(state.currentDraft.authorLink)) &&
                        (!submitService.normalizeAuthorLink || !submitService.normalizeAuthorLink(state.currentDraft.authorLink))
                )
            );
            state.submitModalButton.disabled = !state.isDirty || Boolean(validationError) || state.submitting;
        };
    }

    function buildToolbar(state) {
        const bar = createElement("section", "theme-editor-route-bar");
        const shell = createElement("div", "theme-editor-route-shell");
        const top = createElement("div", "theme-editor-route-top");
        const headingGroup = createElement("div", "theme-editor-route-heading");
        const title = createElement("h2", "theme-editor-title", state.labels.panelTitle);
        const controls = createElement("div", "theme-editor-route-controls");
        const actions = createElement("div", "theme-editor-route-actions");
        const statusRow = createElement("div", "theme-editor-route-status");
        const controlsBody = createElement("div", "theme-editor-route-details-body");
        const controlsGrid = createElement("div", "theme-editor-route-grid");
        const resizeHandle = createElement("div", "theme-editor-resize-handle");
        const resizeGrip = createElement("span", "theme-editor-resize-grip");
        const exitLink = createElement("a", "theme-button theme-editor-button theme-editor-button-secondary");
        const resetButton = createElement("button", "theme-button theme-editor-button theme-editor-button-secondary", state.labels.reset);
        const submitButton = createElement("button", "theme-button theme-editor-button theme-editor-button-primary", state.labels.submit);
        const status = createElement("p", "theme-editor-status");
        const toast = createElement("div", "theme-editor-toast");
        const toastIcon = createElement("span", "theme-editor-toast-icon");
        const toastMessage = createElement("p", "theme-editor-toast-message");

        title.id = "theme-editor-title";
        exitLink.href = getCustomizationExitHref(state.locale);
        exitLink.textContent = state.labels.exit;
        resetButton.type = "button";
        submitButton.type = "button";
        resizeHandle.setAttribute("role", "separator");
        resizeHandle.setAttribute("aria-orientation", "horizontal");
        resizeHandle.setAttribute("aria-label", state.labels.resize);
        resizeHandle.tabIndex = 0;
        resizeGrip.setAttribute("aria-hidden", "true");

        status.hidden = true;
        status.setAttribute("aria-live", "polite");
        statusRow.hidden = true;
        toast.hidden = true;
        toast.setAttribute("aria-live", "polite");
        toast.dataset.visible = "false";
        toastIcon.append(createSuccessToastIcon());
        toast.append(toastIcon, toastMessage);

        actions.append(exitLink, resetButton, submitButton);
        controls.append(actions);
        headingGroup.append(title);
        top.append(headingGroup, controls);
        statusRow.append(status);

        editorConfig.sections.forEach((sectionConfig) => {
            const sectionEntries = [];

            (sectionConfig.fields || []).forEach((fieldConfig) => {
                const entry = createTokenField(state, fieldConfig);

                state.fieldEntries.push(entry);
                sectionEntries.push(entry);
            });

            if (!sectionEntries.length) {
                return;
            }

            const section = createElement("section", "theme-editor-card theme-editor-section");
            const sectionTitle = createElement(
                "h3",
                "theme-editor-section-title",
                getLocalizedText(sectionConfig.title, state.locale)
            );
            const sectionFields = createElement("div", "theme-editor-section-fields");

            section.append(sectionTitle, sectionFields);

            sectionEntries.forEach((entry) => {
                sectionFields.append(entry.element);
            });

            controlsGrid.append(section);
        });

        controlsBody.append(controlsGrid);
        controlsBody.hidden = !controlsGrid.childElementCount;
        resizeHandle.append(resizeGrip);
        shell.append(top, statusRow, controlsBody, resizeHandle);
        bar.append(shell);

        state.root = bar;
        state.statusRow = statusRow;
        state.scroll = controlsBody;
        state.resetButton = resetButton;
        state.submitButton = submitButton;
        state.status = status;
        state.exitLink = exitLink;
        state.resizeHandle = resizeHandle;
        state.toast = toast;
        state.toastMessage = toastMessage;

        document.body.prepend(bar);
        document.body.append(toast);
        buildColorPicker(state);
        buildSubmitModal(state);
        applyEditorHeight(state, state.editorHeight);
    }

    function bindToolbarEvents(state) {
        state.scroll.addEventListener("scroll", () => {
            if (state.colorPicker.entry) {
                positionColorPicker(state);
            }
        });

        state.resizeHandle.addEventListener("pointerdown", (event) => {
            event.preventDefault();

            const startY = event.clientY;
            const startHeight = state.editorHeight;

            document.body.classList.add("theme-editor-is-resizing");
            closeColorPicker(state);

            const handlePointerMove = (moveEvent) => {
                applyEditorHeight(state, startHeight + (moveEvent.clientY - startY));
            };

            const handlePointerUp = () => {
                document.body.classList.remove("theme-editor-is-resizing");
                window.removeEventListener("pointermove", handlePointerMove);
                window.removeEventListener("pointerup", handlePointerUp);
                window.removeEventListener("pointercancel", handlePointerUp);
                persistEditorHeight(state.editorHeight);
            };

            window.addEventListener("pointermove", handlePointerMove);
            window.addEventListener("pointerup", handlePointerUp, {
                once: true
            });
            window.addEventListener("pointercancel", handlePointerUp, {
                once: true
            });
        });

        state.resizeHandle.addEventListener("keydown", (event) => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
                return;
            }

            event.preventDefault();
            applyEditorHeight(state, state.editorHeight + (event.key === "ArrowDown" ? 20 : -20));
            persistEditorHeight(state.editorHeight);
        });

        window.addEventListener("resize", () => {
            applyEditorHeight(state, state.editorHeight);
        });

        state.resetButton.addEventListener("click", () => {
            resetPreview(state);
        });

        state.submitButton.addEventListener("click", () => {
            if (!state.isDirty || state.submitting) {
                return;
            }

            setStatus(state, "", "");
            openSubmitModal(state);
        });

        state.submitThemeInput.addEventListener("input", () => {
            state.submitModalThemeTouched = true;
            updateSubmitDraftField(state, "themeName", state.submitThemeInput.value);
        });

        state.submitThemeInput.addEventListener("blur", () => {
            state.submitModalThemeTouched = true;
            updateSubmitDraftField(state, "themeName", state.submitThemeInput.value);
        });

        state.submitAuthorInput.addEventListener("input", () => {
            state.submitModalAuthorTouched = true;
            updateSubmitDraftField(state, "authorName", state.submitAuthorInput.value);
        });

        state.submitAuthorInput.addEventListener("blur", () => {
            state.submitModalAuthorTouched = true;
            updateSubmitDraftField(state, "authorName", state.submitAuthorInput.value);
        });

        state.submitAuthorLinkInput.addEventListener("input", () => {
            state.submitModalAuthorLinkTouched = true;
            updateSubmitDraftField(state, "authorLink", state.submitAuthorLinkInput.value);
        });

        state.submitAuthorLinkInput.addEventListener("blur", () => {
            state.submitModalAuthorLinkTouched = true;
            updateSubmitDraftField(state, "authorLink", state.submitAuthorLinkInput.value);
        });

        state.submitModalCloseButton.addEventListener("click", () => {
            closeSubmitModal(state);
        });

        state.submitModal.addEventListener("pointerdown", (event) => {
            if (event.target === state.submitModal) {
                closeSubmitModal(state);
            }
        });

        state.submitModalButton.addEventListener("click", () => {
            const payload = buildPayload(state);
            const validationError = validateEditorPayload(state, payload);
            const endpoint = submitService.resolveEndpointUrl
                ? submitService.resolveEndpointUrl(submitService.getConfiguredEndpoint(state.root))
                : submitService.getConfiguredEndpoint(state.root);

            state.submitModalThemeTouched = true;
            state.submitModalAuthorTouched = true;
            state.updateSubmitModalState();

            if (!state.isDirty) {
                setSubmitModalStatus(state, "validation", state.labels.noChanges);
                return;
            }

            if (validationError) {
                setSubmitModalStatus(state, "validation", validationError);
                return;
            }

            if (!textValue(endpoint)) {
                setSubmitModalStatus(state, "error", normalizeSubmitErrorMessage(state, {
                    result: {
                        data: {
                            code: "invalid_endpoint"
                        }
                    }
                }));
                return;
            }

            state.submitting = true;
            state.submitButton.disabled = true;
            state.submitButton.textContent = state.labels.submitting;
            state.submitModalButton.textContent = state.labels.submitting;
            state.updateSubmitModalState();
            setSubmitModalStatus(state, "", "");
            setStatus(state, "", "");

            submitService
                .submitPayload(payload, endpoint)
                .then((result) => {
                    state.submitting = false;
                    state.submitButton.disabled = true;
                    state.submitButton.textContent = state.labels.submitted;
                    state.submitModalButton.disabled = true;
                    state.submitModalButton.textContent = state.labels.submitted;
                    clearDraftRecord();
                    closeSubmitModal(state);
                    setStatus(state, "", "");
                    showToast(state, "success", state.labels.submitNotice, {
                        duration: submitSuccessNoticeDurationMs
                    });

                    window.setTimeout(() => {
                        window.location.href = getCustomizationExitHref(state.locale);
                    }, submitSuccessRedirectDelayMs);
                })
                .catch((error) => {
                    state.submitting = false;
                    state.submitButton.textContent = state.labels.submit;
                    state.submitModalButton.textContent = state.labels.submitNow;
                    if (window.console && typeof window.console.error === "function") {
                        window.console.error("[wayoki-theme-submit] submit failed", {
                            message: textValue(error && error.message),
                            result: error && error.result ? error.result : null,
                            payload
                        });
                    }
                    setSubmitModalStatus(state, "error", normalizeSubmitErrorMessage(state, error));
                    persistDraftRecord(state);
                    updateButtonState(state);
                });
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && state.submitModal && !state.submitModal.hidden) {
                closeSubmitModal(state);
                return;
            }

            if (event.key === "Escape" && state.colorPicker.entry) {
                closeColorPicker(state);
            }
        });

        const observer = new MutationObserver((mutations) => {
            const themeChanged = mutations.some(
                (mutation) => mutation.attributeName === "data-theme" || mutation.attributeName === "data-theme-selection"
            );

            if (!themeChanged || state.isApplyingDraft) {
                return;
            }

            const wasDirty = state.isDirty;

            captureBaseSnapshot(state);

            if (wasDirty) {
                state.currentDraft = readDraftFromPreview(state);
                applyDraftToPreview(state, state.currentDraft, {
                    silent: true
                });
            } else {
                state.baselineDraft = buildBaseDraft(state);
                state.currentDraft = cloneDraft(state.baselineDraft);
                applyDraftToPreview(state, state.currentDraft, {
                    silent: true
                });
            }

            persistDraftRecord(state);
            updateButtonState(state);
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme", "data-theme-selection"]
        });
    }

    function restoreDraftState(state) {
        const storedRecord = readStoredDraftRecord();

        if (storedRecord && storedRecord.current && textValue(storedRecord.current.baseTheme) && themeRuntime && typeof themeRuntime.applyTheme === "function") {
            const storedTheme = textValue(storedRecord.current.baseTheme);

            if (storedTheme && storedTheme !== submitService.getCurrentTheme()) {
                themeRuntime.applyTheme(storedTheme);
            }
        }

        captureBaseSnapshot(state);

        const fallbackDraft = buildBaseDraft(state);

        if (!storedRecord) {
            state.baselineDraft = cloneDraft(fallbackDraft);
            state.currentDraft = cloneDraft(fallbackDraft);
            applyDraftToPreview(state, state.currentDraft, {
                silent: true
            });
            updateButtonState(state);
            return;
        }

        state.baselineDraft = buildDraftFromSource(state, storedRecord.baseline, fallbackDraft);
        state.currentDraft = buildDraftFromSource(state, storedRecord.current, state.baselineDraft);
        applyDraftToPreview(state, state.currentDraft, {
            silent: true
        });
        persistDraftRecord(state);
        updateButtonState(state);
    }

    function initThemeEditor() {
        if (!isCustomizationRoute()) {
            return;
        }

        const locale = getLocale();
        const state = {
            locale,
            labels: getLabels(locale),
            fieldEntries: [],
            baseSnapshot: {
                theme: submitService.getCurrentTheme(),
                tokens: {},
                creditText: "",
                authorLink: ""
            },
            editorHeight: getStoredEditorHeight(),
            baselineDraft: null,
            currentDraft: null,
            submitModalThemeTouched: false,
            submitModalAuthorTouched: false,
            submitModalAuthorLinkTouched: false,
            submitting: false,
            isDirty: false,
            isApplyingDraft: false,
            previewHighlightTargets: [],
            previewHighlightTimeout: 0,
            colorPicker: {
                popover: null,
                entry: null,
                hsva: {
                    h: 0,
                    s: 1,
                    v: 1,
                    a: 1
                }
            }
        };

        document.body.classList.add("customization-mode");
        buildToolbar(state);
        restoreDraftState(state);
        bindToolbarEvents(state);
        updateButtonState(state);
    }

    document.addEventListener("DOMContentLoaded", () => {
        initThemeEditor();
    });

    window.WayokiThemeEditorDraft = {
        draftStorageKey,
        readStoredDraftRecord,
        applyStoredDraftPreview
    };
})();
