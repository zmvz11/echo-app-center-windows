# Echo Add Apps Store Builder Standard

Echo App Center now uses a Steam-inspired Store, Library, and app-detail builder while keeping Echo branding and ownership.

## Admin Portal flow

Open `Admin Portal -> Add Apps`.

The Add Apps page is the single place to create, edit, preview, and post Store apps. Media is no longer a separate admin page. Images are dropped directly into the same positions where they will appear in the Store template.

1. Click `Add Apps` in the Admin Portal sidebar.
2. Click `Create New App Page` or select an existing app from the left rail.
3. Fill the Store page directly inside the product-page template.
4. Drag/drop images into the main hero, thumbnail, icon, library banner, and screenshot areas.
5. Attach an optional release ZIP in the download/package section.
6. Review the readiness checklist.
7. Click `Save Draft` or `Post App`.

## Store asset sizes

Use these sizes for clean results:

| Asset | Recommended Size | Notes |
| --- | --- | --- |
| Icon | 512x512 | PNG, transparent preferred |
| Store Hero / Main Media | 1920x720 | Large app detail and Store feature image |
| Library Banner | 1920x620 | Header shown on Library detail |
| Card Thumbnail | 600x338 | Store grid card, 16:9 |
| Screenshots | 1920x1080 | Minimum 3 recommended |

Accepted image formats: PNG, JPG, WEBP.

## Add Apps builder layout

The builder uses a Steam-style product-page template:

- title and breadcrumb area
- large media theater
- screenshot strip
- right-side app summary panel
- developer/category/platform/tags details
- download/release package section
- About This App section
- Store row/card preview
- fixed bottom `Save Draft` / `Post App` action bar

The preview and the real Store use shared display components so the builder stays close to what users see.

## Server vs App Center responsibility

Server owns the data:

- app metadata
- published/hidden/draft status
- featured flag
- uploaded media
- releases/packages
- Store API responses

App Center owns the presentation:

- Store homepage
- app cards
- featured hero
- category rows
- app detail page
- Library layout
- Add Apps visual builder

## Store API routes

Public Store routes:

- `GET /api/store/apps`
- `GET /api/store/featured`
- `GET /api/store/categories`
- `GET /api/store/sections`
- `GET /api/store/apps/:id`

Admin App routes:

- `POST /api/apps/admin/create`
- `PATCH /api/apps/admin/:id`
- `PATCH /api/apps/admin/:id/featured`
- `PATCH /api/apps/admin/:id/visibility`
- `POST /api/apps/admin/:id/media/upload`

## Repository update workflow

Do not upload zip files to the code tab.

1. Extract this updated package.
2. Copy the changed files into your local GitHub Desktop repo folder, or use Git to merge them.
3. Open GitHub Desktop.
4. Review changed files.
5. Commit with a message like `Major Store, Library, and Add Apps builder update`.
6. Push origin.
7. Rebuild/reinstall locally if testing the installed app.
