#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const submissionsRoot = path.join(repoRoot, "collab/site-ui/submissions");
const outputPath = path.join(repoRoot, "collab/site-ui/theme-registry.js");

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

function parseIsoToTimestamp(value) {
    const timestamp = Date.parse(textValue(value));

    return Number.isFinite(timestamp) ? timestamp : 0;
}

function parseLegacyPathTimestamp(filePath) {
    const match = textValue(filePath).match(/(?:^|\/)(\d{8})-(\d{6})-[^/]+\.json$/u);

    if (!match) {
        return 0;
    }

    const year = Number(match[1].slice(0, 4));
    const month = Number(match[1].slice(4, 6));
    const day = Number(match[1].slice(6, 8));
    const hour = Number(match[2].slice(0, 2));
    const minute = Number(match[2].slice(2, 4));
    const second = Number(match[2].slice(4, 6));

    return Date.UTC(year, month - 1, day, hour, minute, second);
}

function sanitizeTokens(tokens) {
    if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) {
        return {};
    }

    return Object.keys(tokens)
        .filter((key) => key.startsWith("--"))
        .sort()
        .reduce((result, key) => {
            const value = textValue(tokens[key]);

            if (value) {
                result[key] = value;
            }

            return result;
        }, {});
}

function getCanonicalSubmissionPath(authorSlug, themeSlug) {
    return `collab/site-ui/submissions/${authorSlug}/${themeSlug}.json`;
}

function buildCustomThemeId(authorSlug, themeSlug) {
    return `${authorSlug}/${themeSlug}`;
}

function normalizeSubmissionEntry(filePath, document) {
    const themeName = textValue(document && document.themeName);
    const authorName = textValue(document && document.authorName);
    const authorSlug = textValue(document && document.authorSlug) || slugify(authorName);
    const themeSlug = textValue(document && document.themeSlug) || slugify(themeName);
    const tokens = sanitizeTokens(document && document.tokens);

    if (!themeName || !authorName || !authorSlug || !themeSlug || !Object.keys(tokens).length) {
        return null;
    }

    return {
        filePath,
        canonicalKey: `${authorSlug}/${themeSlug}`,
        canonicalFilePath: getCanonicalSubmissionPath(authorSlug, themeSlug),
        themeName,
        authorName,
        authorSlug,
        themeSlug,
        creditText: textValue(document && document.creditText) || `by: ${authorName}`,
        sourceTheme: textValue(document && document.sourceTheme),
        createdAt: textValue(document && document.createdAt) || textValue(document && document.submittedAt),
        updatedAt: textValue(document && document.updatedAt) || textValue(document && document.submittedAt),
        version: Number(document && document.version) || 1,
        tokens,
        sortTimestamp: Math.max(
            parseIsoToTimestamp(document && document.updatedAt),
            parseIsoToTimestamp(document && document.submittedAt),
            parseIsoToTimestamp(document && document.createdAt),
            parseLegacyPathTimestamp(filePath)
        )
    };
}

function compareNormalizedSubmissionEntries(left, right) {
    if (left.sortTimestamp !== right.sortTimestamp) {
        return left.sortTimestamp - right.sortTimestamp;
    }

    if (left.version !== right.version) {
        return left.version - right.version;
    }

    const leftIsCanonical = left.filePath === left.canonicalFilePath;
    const rightIsCanonical = right.filePath === right.canonicalFilePath;

    if (leftIsCanonical !== rightIsCanonical) {
        return leftIsCanonical ? 1 : -1;
    }

    return left.filePath.localeCompare(right.filePath);
}

function selectPublishedSubmissionEntries(entries) {
    const winners = new Map();

    for (const normalized of entries) {
        const currentWinner = winners.get(normalized.canonicalKey);

        if (!currentWinner || compareNormalizedSubmissionEntries(normalized, currentWinner) > 0) {
            winners.set(normalized.canonicalKey, normalized);
        }
    }

    return Array.from(winners.values()).filter((entry) => entry.filePath === entry.canonicalFilePath);
}

function buildThemeRegistryEntry(normalized) {
    return {
        id: buildCustomThemeId(normalized.authorSlug, normalized.themeSlug),
        sortKey: `${normalized.themeName.toLowerCase()}\u0000${normalized.authorName.toLowerCase()}\u0000${normalized.authorSlug}\u0000${normalized.themeSlug}`,
        meta: {
            group: "author",
            label: normalized.themeName,
            themeName: normalized.themeName,
            authorName: normalized.authorName,
            authorSlug: normalized.authorSlug,
            themeSlug: normalized.themeSlug,
            credit: normalized.creditText,
            sourceTheme: normalized.sourceTheme,
            submissionPath: normalized.filePath,
            canonicalSubmissionPath: normalized.canonicalFilePath,
            version: normalized.version,
            createdAt: normalized.createdAt,
            updatedAt: normalized.updatedAt,
            tokens: normalized.tokens
        }
    };
}

async function readJsonFiles(directoryPath) {
    const directoryEntries = await fs.readdir(directoryPath, {
        withFileTypes: true
    });
    const files = [];

    for (const entry of directoryEntries) {
        const absolutePath = path.join(directoryPath, entry.name);

        if (entry.isDirectory()) {
            files.push(...(await readJsonFiles(absolutePath)));
            continue;
        }

        if (entry.isFile() && entry.name.endsWith(".json")) {
            files.push(absolutePath);
        }
    }

    return files.sort();
}

function toRepoRelativePath(absolutePath) {
    return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

async function collectPublishedThemes() {
    const absoluteFiles = await readJsonFiles(submissionsRoot);
    const normalizedEntries = [];

    for (const absoluteFile of absoluteFiles) {
        const filePath = toRepoRelativePath(absoluteFile);
        const rawValue = await fs.readFile(absoluteFile, "utf8");
        const document = JSON.parse(rawValue);
        const normalized = normalizeSubmissionEntry(filePath, document);

        if (!normalized) {
            continue;
        }

        normalizedEntries.push(normalized);
    }

    return selectPublishedSubmissionEntries(normalizedEntries);
}

function buildRegistryScript(normalizedEntries) {
    const themeCatalog = {
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

    normalizedEntries
        .map((entry) => buildThemeRegistryEntry(entry))
        .sort((left, right) => left.sortKey.localeCompare(right.sortKey))
        .forEach((entry) => {
            themeCatalog[entry.id] = entry.meta;
        });

    const registry = {
        generatedFrom: "collab/site-ui/submissions",
        defaultTheme: "light",
        themeCatalog
    };

    return `(function () {\n    window.WayokiThemeRegistry = ${JSON.stringify(registry, null, 4).replace(/\n/g, "\n    ")};\n})();\n`;
}

const publishedThemes = await collectPublishedThemes();
await fs.writeFile(outputPath, buildRegistryScript(publishedThemes), "utf8");
console.log(`Generated theme registry with ${publishedThemes.length} published custom theme(s).`);
