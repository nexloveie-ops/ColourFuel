# ColourFuel

English-language ColourFuel website for the Irish market, using the supplied horizontal and round brand logos.

## What is included

- Responsive recipe discovery and ingredient library.
- Search, colour/category filters and browser-local saved recipes.
- Recipe details, adjustable servings and per-serving/whole-recipe nutrition.
- Ingredient-level nutrition, original food codes, dataset versions and reference-imputation sources.
- A verified snapshot of 30 ingredients and 5 development recipes, dated 15 November 2026.

The site currently serves a **data snapshot**, not a live Cloud SQL connection. Source values, trace markers and explicitly labelled reference estimates remain distinguishable. Unsupported nutrient values are not replaced with zero. These recipes and matching decisions are development drafts.

## Run

Requires Node.js 22. No package installation is needed.

```sh
npm run check
npm start
```

Open `http://localhost:8080`. The server reads Cloud Run's `PORT` environment variable, exposes `/healthz` and serves only explicitly allowed public files.

## Deploy to Google Cloud

Target project: `project-4e0cb90b-8fb2-452b-9f0`. Region: `europe-west1`.

From an authenticated environment with the required Cloud Run source-deployment permissions:

```sh
gcloud run deploy colourfuel-web \
  --source . \
  --project project-4e0cb90b-8fb2-452b-9f0 \
  --region europe-west1 \
  --allow-unauthenticated \
  --execution-environment gen2 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 1 \
  --concurrency 80 \
  --timeout 60
```

The Dockerfile runs as the built-in non-root Node user. No database passwords, cloud credentials or private user data are included. No database permissions are needed by this snapshot-only website. The existing project budget is an alert, not a hard spending cap.

## Images and data

The two ColourFuel logos were supplied by the project owner. Do not assume permission to reuse this branding in other projects.

Food photographs are from Unsplash and are illustrative; the listed ingredients, not the photograph, determine nutrition:

- Jez Timms: https://unsplash.com/photos/BHD2OxkYGSk
- Markus Spiske: https://unsplash.com/photos/9vzRpZkqpJ8
- Berry yoghurt photograph: https://unsplash.com/photos/LymX5D2sSWM
- Galih Dwi Prasetyo: https://unsplash.com/photos/PKl5YIGnAyA

Nutrition sources: USDA FoodData Central Foundation Foods (October 2026), USDA SR Legacy (April 2018), and Public Health England CoFID 2021. Dataset URLs, licences, file hashes and retrieval dates are retained in `data.json`. Reference estimates preserve donor food IDs and matching notes. The on-page Data & sources dialog provides attribution and original-source links.
