"use strict";

const https = require("node:https");
const { Buffer } = require("node:buffer");

const GITHUB_OWNER = process.env.GITHUB_OWNER || "wayoki";
const GITHUB_REPO = process.env.GITHUB_REPO || "wayoki.com";
const GITHUB_BASE_BRANCH = process.env.GITHUB_BASE_BRANCH || "main";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const USER_AGENT = "wayoki-theme-submit";
const REPO_SUBMISSIONS_ROOT = "collab/site-ui/submissions";
const GENERATED_THEME_REGISTRY_PATH = "collab/site-ui/theme-registry.js";
const ALLOWED_META_KEYS = ["siteLocale", "userAgent", "page"];

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

function sanitizeMeta(meta) {
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
        return {};
    }

    return ALLOWED_META_KEYS.reduce((result, key) => {
        const value = textValue(meta[key]);

        if (value) {
            result[key] = value;
        }

        return result;
    }, {});
}

function buildCustomThemeId(authorSlug, themeSlug) {
    return `submission-${authorSlug}--${themeSlug}`;
}

function buildStoredThemeDocument(payload, existingDocument, authorSlug, themeSlug, nowIso) {
    const previousVersion = Number(existingDocument && existingDocument.version);
    const hasExistingDocument = Boolean(existingDocument);

    return {
        themeName: textValue(payload.themeName),
        authorName: textValue(payload.authorName),
        creditText: textValue(payload.creditText),
        sourceTheme: textValue(payload.sourceTheme),
        submittedAt: textValue(payload.submittedAt) || nowIso,
        createdAt: textValue(existingDocument && existingDocument.createdAt) || nowIso,
        updatedAt: nowIso,
        version: hasExistingDocument ? (Number.isFinite(previousVersion) && previousVersion > 0 ? previousVersion + 1 : 2) : 1,
        authorSlug,
        themeSlug,
        tokens: sanitizeTokens(payload.tokens),
        meta: sanitizeMeta(payload.meta)
    };
}

function buildPullRequestBody(options) {
    return [
        `Submission action: ${options.action}`,
        `Author: ${options.authorName} (${options.authorSlug})`,
        `Theme: ${options.themeName} (${options.themeSlug})`,
        `Path: \`${options.filePath}\``,
        `Registry: \`${GENERATED_THEME_REGISTRY_PATH}\``,
        `Version: ${options.version}`
    ].join("\n");
}

function decodeGitHubContent(content) {
    return Buffer.from(String(content || "").replace(/\n/g, ""), "base64").toString("utf8");
}

function encodeGitHubPath(filePath) {
    return String(filePath || "")
        .split("/")
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join("/");
}

function parseJsonBody(event) {
    if (!event || !event.body) {
        return {};
    }

    const rawBody = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;

    return JSON.parse(rawBody);
}

function createJsonResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        },
        body: JSON.stringify(body)
    };
}

function githubRequest(pathname, options = {}) {
    const method = options.method || "GET";
    const requestBody = options.body ? JSON.stringify(options.body) : "";
    const headers = {
        Accept: "application/vnd.github+json",
        "User-Agent": USER_AGENT,
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...options.headers
    };

    if (requestBody) {
        headers["Content-Type"] = "application/json";
        headers["Content-Length"] = Buffer.byteLength(requestBody);
    }

    return new Promise((resolve, reject) => {
        const request = https.request(
            {
                hostname: "api.github.com",
                port: 443,
                path: pathname,
                method,
                headers
            },
            (response) => {
                let rawData = "";

                response.setEncoding("utf8");
                response.on("data", (chunk) => {
                    rawData += chunk;
                });
                response.on("end", () => {
                    const contentType = String(response.headers["content-type"] || "");
                    let parsedBody = rawData;

                    if (contentType.includes("application/json") && rawData) {
                        try {
                            parsedBody = JSON.parse(rawData);
                        } catch (error) {
                            parsedBody = rawData;
                        }
                    }

                    resolve({
                        statusCode: response.statusCode || 500,
                        headers: response.headers,
                        body: parsedBody
                    });
                });
            }
        );

        request.on("error", reject);

        if (requestBody) {
            request.write(requestBody);
        }

        request.end();
    });
}

async function githubJson(pathname, options = {}) {
    const response = await githubRequest(pathname, options);

    if (response.statusCode >= 200 && response.statusCode < 300) {
        return response.body;
    }

    const message =
        response.body && typeof response.body === "object" && textValue(response.body.message)
            ? textValue(response.body.message)
            : `GitHub request failed with status ${response.statusCode}`;
    const error = new Error(message);

    error.statusCode = response.statusCode;
    error.responseBody = response.body;
    throw error;
}

async function readExistingSubmission(filePath) {
    const fileRecord = await readExistingFile(filePath);

    return {
        exists: fileRecord.exists,
        sha: fileRecord.sha,
        document: fileRecord.exists ? JSON.parse(fileRecord.content) : null
    };
}

async function readExistingFile(filePath) {
    try {
        const response = await githubJson(
            `/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/contents/${encodeGitHubPath(
                filePath
            )}?ref=${encodeURIComponent(GITHUB_BASE_BRANCH)}`
        );

        return {
            exists: true,
            sha: response.sha,
            content: decodeGitHubContent(response.content)
        };
    } catch (error) {
        if (error.statusCode === 404) {
            return {
                exists: false,
                sha: "",
                content: ""
            };
        }

        throw error;
    }
}

async function readBranchInfo(branchName) {
    return githubJson(
        `/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/branches/${encodeURIComponent(
            branchName
        )}`
    );
}

async function createWorkingBranch(authorSlug, themeSlug) {
    const branchInfo = await readBranchInfo(GITHUB_BASE_BRANCH);
    const branchName = `theme-submit/${authorSlug}/${themeSlug}-${Date.now()}`;

    await githubJson(`/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/git/refs`, {
        method: "POST",
        body: {
            ref: `refs/heads/${branchName}`,
            sha: branchInfo.commit.sha
        }
    });

    return branchName;
}

async function writeRepositoryFile(options) {
    const body = {
        message: options.commitMessage,
        content: Buffer.from(options.content, "utf8").toString("base64"),
        branch: options.branchName
    };

    if (options.sha) {
        body.sha = options.sha;
    }

    return githubJson(
        `/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/contents/${encodeGitHubPath(
            options.filePath
        )}`,
        {
            method: "PUT",
            body
        }
    );
}

async function getBranchTreeSha(branchName) {
    const branchInfo = await readBranchInfo(branchName);
    const nestedTreeSha = textValue(branchInfo && branchInfo.commit && branchInfo.commit.commit && branchInfo.commit.commit.tree && branchInfo.commit.commit.tree.sha);

    if (nestedTreeSha) {
        return nestedTreeSha;
    }

    const commitSha = textValue(branchInfo && branchInfo.commit && branchInfo.commit.sha);

    if (!commitSha) {
        throw new Error(`Couldn't resolve tree sha for branch ${branchName}`);
    }

    const commitInfo = await githubJson(
        `/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/git/commits/${encodeURIComponent(commitSha)}`
    );
    const treeSha = textValue(commitInfo && commitInfo.tree && commitInfo.tree.sha);

    if (!treeSha) {
        throw new Error(`Couldn't resolve tree sha for branch ${branchName}`);
    }

    return treeSha;
}

async function listSubmissionFiles(branchName) {
    const treeSha = await getBranchTreeSha(branchName);
    const treeInfo = await githubJson(
        `/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`
    );
    const treeEntries = Array.isArray(treeInfo && treeInfo.tree) ? treeInfo.tree : [];

    return treeEntries
        .filter((entry) => {
            return (
                entry &&
                entry.type === "blob" &&
                textValue(entry.path).startsWith(`${REPO_SUBMISSIONS_ROOT}/`) &&
                textValue(entry.path).endsWith(".json")
            );
        })
        .map((entry) => textValue(entry.path))
        .sort();
}

function buildThemeRegistryEntry(filePath, document) {
    const themeName = textValue(document && document.themeName);
    const authorName = textValue(document && document.authorName);
    const authorSlug = textValue(document && document.authorSlug) || slugify(authorName);
    const themeSlug = textValue(document && document.themeSlug) || slugify(themeName);
    const creditText = textValue(document && document.creditText) || (authorName ? `by: ${authorName}` : "");
    const tokens = sanitizeTokens(document && document.tokens);

    if (!themeName || !authorName || !authorSlug || !themeSlug || !Object.keys(tokens).length) {
        return null;
    }

    return {
        id: buildCustomThemeId(authorSlug, themeSlug),
        sortKey: `${themeName.toLowerCase()}\u0000${authorName.toLowerCase()}\u0000${authorSlug}\u0000${themeSlug}`,
        meta: {
            group: "author",
            label: themeName,
            themeName,
            authorName,
            authorSlug,
            themeSlug,
            credit: creditText,
            sourceTheme: textValue(document && document.sourceTheme),
            submissionPath: filePath,
            version: Number(document && document.version) || 1,
            createdAt: textValue(document && document.createdAt),
            updatedAt: textValue(document && document.updatedAt),
            tokens
        }
    };
}

function buildThemeRegistryDocument(submissionEntries) {
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

    submissionEntries
        .map((entry) => buildThemeRegistryEntry(entry.filePath, entry.document))
        .filter(Boolean)
        .sort((left, right) => left.sortKey.localeCompare(right.sortKey))
        .forEach((entry) => {
            themeCatalog[entry.id] = entry.meta;
        });

    return {
        generatedFrom: REPO_SUBMISSIONS_ROOT,
        defaultTheme: "light",
        themeCatalog
    };
}

function buildThemeRegistryScript(submissionEntries) {
    const registry = buildThemeRegistryDocument(submissionEntries);
    const serializedRegistry = JSON.stringify(registry, null, 4).replace(/\n/g, "\n    ");

    return `(function () {\n    window.WayokiThemeRegistry = ${serializedRegistry};\n})();\n`;
}

async function collectRegistrySubmissions(currentFilePath, currentDocument) {
    const filePaths = await listSubmissionFiles(GITHUB_BASE_BRANCH);
    const existingEntries = await Promise.all(
        filePaths.map(async (filePath) => {
            const submission = await readExistingSubmission(filePath);

            return submission.exists
                ? {
                      filePath,
                      document: submission.document
                  }
                : null;
        })
    );
    const entryMap = new Map();

    existingEntries.filter(Boolean).forEach((entry) => {
        entryMap.set(entry.filePath, entry.document);
    });

    entryMap.set(currentFilePath, currentDocument);

    return Array.from(entryMap.entries()).map(([filePath, document]) => ({
        filePath,
        document
    }));
}

async function createPullRequest(options) {
    return githubJson(`/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/pulls`, {
        method: "POST",
        body: {
            title: options.title,
            head: options.branchName,
            base: GITHUB_BASE_BRANCH,
            body: options.body,
            maintainer_can_modify: true
        }
    });
}

exports.handler = async function handler(event) {
    if (event && event.httpMethod === "OPTIONS") {
        return createJsonResponse(204, {});
    }

    if (event && event.httpMethod && event.httpMethod !== "POST") {
        return createJsonResponse(405, {
            ok: false,
            error: "Method not allowed"
        });
    }

    if (!GITHUB_TOKEN) {
        return createJsonResponse(500, {
            ok: false,
            error: "GITHUB_TOKEN is not configured"
        });
    }

    try {
        let payload;

        try {
            payload = parseJsonBody(event);
        } catch (error) {
            return createJsonResponse(400, {
                ok: false,
                error: "Invalid JSON body"
            });
        }

        const authorName = textValue(payload.authorName);
        const themeName = textValue(payload.themeName);
        const authorSlug = slugify(authorName);
        const themeSlug = slugify(themeName);
        const sanitizedTokens = sanitizeTokens(payload.tokens);

        if (!authorName || !authorSlug) {
            return createJsonResponse(400, {
                ok: false,
                error: "authorName is required"
            });
        }

        if (!themeName || !themeSlug) {
            return createJsonResponse(400, {
                ok: false,
                error: "themeName is required"
            });
        }

        if (!Object.keys(sanitizedTokens).length) {
            return createJsonResponse(400, {
                ok: false,
                error: "tokens are required"
            });
        }

        const filePath = `${REPO_SUBMISSIONS_ROOT}/${authorSlug}/${themeSlug}.json`;
        const existingSubmission = await readExistingSubmission(filePath);
        const nowIso = new Date().toISOString();
        const document = buildStoredThemeDocument(
            {
                ...payload,
                tokens: sanitizedTokens
            },
            existingSubmission.document,
            authorSlug,
            themeSlug,
            nowIso
        );
        const action = existingSubmission.exists ? "update" : "create";
        const branchName = await createWorkingBranch(authorSlug, themeSlug);
        const commitMessage =
            action === "create"
                ? `Add theme submission: ${themeSlug} by ${authorSlug}`
                : `Update theme submission: ${themeSlug} by ${authorSlug}`;
        const existingRegistry = await readExistingFile(GENERATED_THEME_REGISTRY_PATH);
        const registryScript = buildThemeRegistryScript(await collectRegistrySubmissions(filePath, document));

        await writeRepositoryFile({
            branchName,
            commitMessage,
            content: `${JSON.stringify(document, null, 2)}\n`,
            filePath,
            sha: existingSubmission.sha
        });
        await writeRepositoryFile({
            branchName,
            commitMessage,
            content: registryScript,
            filePath: GENERATED_THEME_REGISTRY_PATH,
            sha: existingRegistry.sha
        });

        const pullRequest = await createPullRequest({
            branchName,
            title: action === "create" ? `Add theme: ${themeSlug} by ${authorSlug}` : `Update theme: ${themeSlug} by ${authorSlug}`,
            body: buildPullRequestBody({
                action,
                authorName,
                authorSlug,
                themeName,
                themeSlug,
                filePath,
                version: document.version
            })
        });

        return createJsonResponse(200, {
            ok: true,
            action,
            authorSlug,
            themeSlug,
            path: filePath,
            version: document.version,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
            pullRequestUrl: pullRequest.html_url || "",
            pullRequestNumber: pullRequest.number || null
        });
    } catch (error) {
        return createJsonResponse(500, {
            ok: false,
            error: textValue(error && error.message) || "Unknown error"
        });
    }
};
