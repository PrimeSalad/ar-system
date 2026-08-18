# AccomplishPro

AccomplishPro helps prepare the Municipality of Boac MSWDO accomplishment report using the format in `2026 ACCOMPLISHMENT TRUE .xlsx`. It is independently developed and is not affiliated with a government agency. It has a separate React/TypeScript frontend and Express/TypeScript backend, local draft storage, a live report preview, Gemini-assisted writing, browser printing/PDF, and exact-format Excel export.

## What is included

- Boac report header and municipal seal
- DATE / DESCRIPTION / UNITS table with wrapped descriptions
- Automatic date grouping and merged Excel date cells
- Dynamic rows and reporting periods
- Prepared by / Noted by signatories
- Live print-oriented preview
- Manual activity editor with validation
- Gemini batch drafting from rough daily notes
- Autosaved reports and report switching
- Excel download and Print / PDF output
- Responsive desktop, tablet, and mobile interface
- Server-side schema validation and safe API-key handling

## Quick start

Requirements: Node.js 20 or newer.

```powershell
npm ci
Copy-Item backend\.env.example backend\.env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

The first launch creates a blank report for the current half-month. Drafts are autosaved to `backend/data/reports.json`.

## Connect the Gemini API

1. Open [Google AI Studio](https://aistudio.google.com/apikey) and sign in.
2. Choose or create a Google Cloud project, then select **Create API key**.
3. Copy the key and either paste it into **Gemini settings** in the app or add it to `backend/.env`:

```dotenv
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.5-flash
```

4. Restart `npm run dev` if you configured `backend/.env`.

For a browser-session setup, click **Gemini settings**, follow the built-in tutorial, paste the key, and use **Test connection** before saving. A session key is stored only in that browser tab and sent to the Render API only when testing or drafting. A permanent server key stays on the backend and is never included in the frontend bundle.

Gemini receives only the rough notes submitted to the AI drafting dialog plus the report period, office name, fallback date, and fallback units. Quantities written in the notes take priority; the selected fallback units are used when an entry has no stated quantity. Generated rows remain editable, and the prompt explicitly prohibits inventing facts, dates, quantities, people, or results.

## Everyday workflow

1. Set the reporting start and end dates.
2. Add accomplishments manually, or paste rough notes into **Draft with AI**.
3. Review dates, categories, descriptions, and units in the activity list.
4. Expand **Report details & signatories** if the office header or names need changes.
5. Review the live report preview.
6. Select **Export Excel** for the formatted workbook, or **Print / PDF** for a browser printout.

## Production build

```powershell
npm run check
npm start
```

`npm run check` runs TypeScript validation, automated tests, and both production builds. `npm start` runs the compiled API at [http://localhost:4000](http://localhost:4000); the production frontend is deployed separately.

## Deployment

The Express API is deployed on Render from `render.yaml`. Render installs the build tooling, builds only the backend workspace, prunes development dependencies, checks `/api/health`, and starts the API server.

The React frontend is deployed separately on Vercel from `vercel.json`. Set the Vercel build environment variable `VITE_API_URL` to the public Render service URL so browser requests reach the API.

The app can use a browser-session Gemini key without a server secret. To configure Gemini for everyone, add `GEMINI_API_KEY` in the Render service environment. Free Render services use an ephemeral filesystem, so saved reports can reset after a restart or redeploy; attach a persistent disk or external datastore before relying on server-side storage for production records.

## Project structure

```text
frontend/
  public/boac-seal.jpg
  src/components/       React report UI and preview
  src/hooks/            Autosave behavior
  src/api.ts             Backend client
  src/styles.css         Responsive design system

backend/
  assets/boac-seal.jpg
  data/                  Local report storage
  src/app.ts             Express API and production static host
  src/excel.ts           Excel generator
  src/gemini.ts          Gemini structured drafting
  src/report-schema.ts   Shared validation rules
  src/store.ts           Atomic JSON persistence
  tests/                 API and workbook tests

design-system/MASTER.md  Product UI rules
```

## Main API routes

- `GET /api/health` — service health
- `GET /api/template` — template metadata and approved categories
- `GET /api/reports` — list saved reports
- `PUT /api/reports/:id` — create or autosave a report
- `DELETE /api/reports/:id` — delete a report
- `GET /api/ai/status` — Gemini configuration status
- `POST /api/ai/test` — verify the API key and configured model
- `POST /api/ai/draft` — convert rough notes into structured activities
- `POST /api/exports/xlsx` — generate the formatted Excel workbook

## Configuration

See `backend/.env.example` for all options:

- `GEMINI_API_KEY` — Google AI Studio API key
- `GEMINI_MODEL` — defaults to `gemini-3.5-flash`
- `PORT` — backend/production port, default `4000`
- `FRONTEND_ORIGIN` — development CORS origin, default `http://localhost:5173`
- `DATA_FILE` — optional absolute path for the JSON report database

The supplied workbook is treated as a reference and is never modified. Every export is generated as a new `.xlsx` file.
