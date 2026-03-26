const test = require("node:test");
const assert = require("node:assert/strict");

const submitThemeModule = require("./index.js");
const helpers = submitThemeModule.__private;

test("buildSubmissionIdentity keeps author/theme order for different values", () => {
    const identity = helpers.buildSubmissionIdentity("theme", "name");

    assert.equal(identity.themeName, "theme");
    assert.equal(identity.authorName, "name");
    assert.equal(identity.themeSlug, "theme");
    assert.equal(identity.authorSlug, "name");
    assert.equal(identity.catalogKey, "name/theme");
    assert.equal(identity.filePath, "collab/site-ui/submissions/name/theme.json");
});

test("same values still work", () => {
    const identity = helpers.buildSubmissionIdentity("test", "test");

    assert.equal(identity.catalogKey, "test/test");
    assert.equal(identity.filePath, "collab/site-ui/submissions/test/test.json");
});

test("different theme for same author uses nested author/theme path", () => {
    const identity = helpers.buildSubmissionIdentity("test1", "test");

    assert.equal(identity.catalogKey, "test/test1");
    assert.equal(identity.filePath, "collab/site-ui/submissions/test/test1.json");
});

test("avtor/temi resolves to the expected nested canonical path", () => {
    const identity = helpers.buildSubmissionIdentity("temi", "avtor");

    assert.equal(identity.authorSlug, "avtor");
    assert.equal(identity.themeSlug, "temi");
    assert.equal(identity.catalogKey, "avtor/temi");
    assert.equal(identity.filePath, "collab/site-ui/submissions/avtor/temi.json");
});

test("different themes for one author generate different canonical paths", () => {
    const one = helpers.buildSubmissionIdentity("kaidan", "wayoki");
    const two = helpers.buildSubmissionIdentity("noir-soft", "wayoki");

    assert.equal(one.catalogKey, "wayoki/kaidan");
    assert.equal(two.catalogKey, "wayoki/noir-soft");
    assert.notEqual(one.filePath, two.filePath);
});

test("same theme name for different authors is allowed", () => {
    const first = helpers.buildSubmissionIdentity("kaidan", "wayoki");
    const second = helpers.buildSubmissionIdentity("kaidan", "alex");

    assert.equal(first.filePath, "collab/site-ui/submissions/wayoki/kaidan.json");
    assert.equal(second.filePath, "collab/site-ui/submissions/alex/kaidan.json");
    assert.notEqual(first.catalogKey, second.catalogKey);
});

test("empty slug after normalization is rejected by identity builder", () => {
    const invalidTheme = helpers.buildSubmissionIdentity("!!!", "name");
    const invalidAuthor = helpers.buildSubmissionIdentity("theme", "###");

    assert.equal(invalidTheme.themeSlug, "");
    assert.equal(invalidTheme.filePath, "");
    assert.equal(invalidAuthor.authorSlug, "");
    assert.equal(invalidAuthor.catalogKey, "");
});

test("stable custom theme id uses author/theme format", () => {
    assert.equal(helpers.buildCustomThemeId("name", "theme"), "name/theme");
    assert.equal(helpers.getCanonicalSubmissionPath("name", "theme"), "collab/site-ui/submissions/name/theme.json");
});

test("working branch name is flat and no longer depends on slash nesting", () => {
    assert.equal(helpers.buildWorkingBranchName("name", "theme", 1234567890), "theme-submit-name--theme-1234567890");
});

test("published registry prefers canonical nested submission paths over legacy flat files", () => {
    const published = helpers.selectPublishedSubmissionEntries([
        {
            filePath: "collab/site-ui/submissions/20260326-082302-avtor-temi.json",
            canonicalFilePath: "collab/site-ui/submissions/avtor/temi.json",
            canonicalKey: "avtor/temi",
            sortTimestamp: 1,
            version: 1
        },
        {
            filePath: "collab/site-ui/submissions/avtor/temi.json",
            canonicalFilePath: "collab/site-ui/submissions/avtor/temi.json",
            canonicalKey: "avtor/temi",
            sortTimestamp: 0,
            version: 1
        }
    ]);

    assert.equal(published.length, 1);
    assert.equal(published[0].filePath, "collab/site-ui/submissions/avtor/temi.json");
});
