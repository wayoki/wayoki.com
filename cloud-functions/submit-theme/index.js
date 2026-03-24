"use strict";

const https = require("node:https");
const { Buffer } = require("node:buffer");

const GITHUB_OWNER = process.env.GITHUB_OWNER || "wayoki";
const GITHUB_REPO = process.env.GITHUB_REPO || "wayoki.com";
const GITHUB_BASE_BRANCH = process.env.GITHUB_BASE_BRANCH || "main";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const USER_AGENT = "wayoki-theme-submit";
const REPO_SUBMISSIONS_ROOT = "collab/site-ui/submissions";
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
    try {
        const response = await githubJson(
            `/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/contents/${encodeGitHubPath(
                filePath
            )}?ref=${encodeURIComponent(GITHUB_BASE_BRANCH)}`
        );
        const decoded = decodeGitHubContent(response.content);

        return {
            exists: true,
            sha: response.sha,
            document: JSON.parse(decoded)
        };
    } catch (error) {
        if (error.statusCode === 404) {
            return {
                exists: false,
                sha: "",
                document: null
            };
        }

        throw error;
    }
}

async function createWorkingBranch(authorSlug, themeSlug) {
    const branchInfo = await githubJson(
        `/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/branches/${encodeURIComponent(
            GITHUB_BASE_BRANCH
        )}`
    );
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

async function writeSubmissionFile(options) {
    const body = {
        message: options.commitMessage,
        content: Buffer.from(`${JSON.stringify(options.document, null, 2)}\n`, "utf8").toString("base64"),
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

        await writeSubmissionFile({
            branchName,
            commitMessage,
            document,
            filePath,
            sha: existingSubmission.sha
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
