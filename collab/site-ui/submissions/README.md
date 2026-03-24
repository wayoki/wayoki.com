# Theme Submissions

Stable merged submission files live here.

Path model:

`collab/site-ui/submissions/<author-slug>/<theme-slug>.json`

Rules:

- one author + one theme name = one stable file path
- repeated submissions update the same file
- `createdAt` stays stable
- `updatedAt` and `version` change on every accepted update
- merged JSON files in this folder are the source of truth for public custom themes
- `collab/site-ui/theme-registry.js` is generated from these files
