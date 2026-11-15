# ColourFuel

English-language ColourFuel website for Ireland, using the supplied horizontal and round logos.

Live website: https://colourfuel-web-721850220313.europe-west1.run.app

## Live ingredient and recipe data

The browser requests `GET /api/catalog` on every page navigation. The server queries Cloud SQL for PostgreSQL directly, with no response cache and no fallback to the archived snapshot. Refreshing the page retrieves current database values. This is request-based freshness, not a push subscription to database changes.

Nutrition, edible weights, servings, source records, reference estimates and recipe totals come from the normalized `colourfuel` tables and views. English editorial copy is stored separately in `colourfuel_web`. Source-defined trace and missing values remain distinct from numeric zero. Recipes remain development drafts; estimates do not include extra cooking-retention adjustments.

The runtime uses automatic IAM database authentication through Google's Cloud SQL Node.js Connector. It has SELECT access only to `colourfuel_web.catalog`, a public development catalogue projection. No database passwords or downloaded account keys are used. The connection pool allows at most three database connections per instance. A production revision must read the database successfully before it accepts traffic.

`data.json` and `data.js` are archived development snapshots. The application does not load or serve them.

## Development

Requires Node.js 22. Run `npm ci`, `npm run check`, and `npm test`. With an authenticated Cloud SQL identity and the following environment variables, run `npm start`:

```
INSTANCE_CONNECTION_NAME=project-4e0cb90b-8fb2-452b-9f0:europe-west1:colourfuel-dev-postgres
DB_NAME=colourfuel
DB_USER=colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam
```

`GET /health` checks the process. `GET /api/catalog` verifies the database connection and returns current catalogue data. If the database is unavailable, the catalogue returns HTTP 503 with a generic error and no stale nutrition data.

## Automatic deployment

The Cloud Build push trigger is limited to `^main$` in `nexloveie-ops/ColourFuel` and uses `cloudbuild.yaml`:

1. Install locked dependencies and run checks and tests.
2. Build and push a container tagged with the Git commit SHA.
3. Update the existing `colourfuel-web` Cloud Run service in `europe-west1`.
4. Verify the live health and catalogue endpoints.

The pipeline does not create services or change IAM, public access, or database schemas. Database migrations are applied separately by an administrator. `004_live_catalog.sql` creates the English editorial tables and public catalogue view, preserves existing source data, and grants the runtime read access only to that view. Seed copy uses `ON CONFLICT DO NOTHING`, preserving subsequent editorial changes.

Target project: `project-4e0cb90b-8fb2-452b-9f0`.
Build identity: `colourfuel-web-build@project-4e0cb90b-8fb2-452b-9f0.iam.gserviceaccount.com`.
Runtime identity: `colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam.gserviceaccount.com`.

Cloud Run scales from zero to a configured maximum of one instance, with 512 MiB memory and one CPU. Builds, image storage and requests can incur charges; the existing budget sends alerts and is not a hard spending cap.

## Images and data attribution

The ColourFuel logos were supplied by the owner. Do not assume permission to reuse them elsewhere. Food photos are illustrative: listed ingredients determine the nutrition calculation.

- Jez Timms: https://unsplash.com/photos/BHD2OxkYGSk
- Markus Spiske: https://unsplash.com/photos/9vzRpZkqpJ8
- Berry yoghurt: https://unsplash.com/photos/LymX5D2sSWM
- Galih Dwi Prasetyo: https://unsplash.com/photos/PKl5YIGnAyA

Sources: USDA FoodData Central Foundation Foods (October 2026), USDA SR Legacy (April 2018), and Public Health England CoFID 2021. Dataset URLs, licences, retrieval dates and file hashes are retained in the database. Reference estimates preserve donor food IDs and matching notes. The on-page Data & sources dialog provides attribution and original-source links.
