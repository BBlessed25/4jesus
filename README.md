# Church_Project — Winter Welfare Registration

Responsive, one-question-at-a-time winter-jacket registration for Gospel Pillars Church Toronto.

## Architecture

```text
Browser → Vercel Function → authenticated Google Apps Script web app → Google Sheet
```

The browser calls only same-origin `/api` endpoints. The Apps Script URL and shared secret exist only in Vercel environment variables and Apps Script Properties.

## Local development

```bash
npm install
cp .env.example .env.local
npx vercel dev
```

`vercel dev` runs the Vite site and the `/api` functions together. `npm run dev` runs only the Vite frontend and is useful when the API is mocked.

### Jacket availability troubleshooting

If the form says live jacket availability cannot be loaded, confirm that you started the full stack with `npx vercel dev` or deployed it to Vercel. Configure the four server-only variables shown below. The form allows users to choose a size during a temporary lookup outage, but a working backend is still required to validate and save the final submission.

## Google Sheets and Apps Script setup

1. Create a Google Sheet for the event and name the spreadsheet exactly `Church_Project`.
2. Open **Extensions → Apps Script**, rename the Apps Script project exactly `Church_Project`, set its timezone to `America/Toronto`, and replace the editor contents with `google-apps-script/Code.gs`.
3. In **Project Settings → Script Properties**, add:
   - `CHURCH_PROJECT_SHARED_SECRET`: the same long random value used in Vercel. Do not use `Church_Project` as the value; generate a separate long random password.
   - `SPREADSHEET_ID`: only needed if the script is not bound to the spreadsheet.
4. Select **Deploy → New deployment → Web app**.
5. Use `Church_Project` as the deployment description/service identifier, set **Execute as** to the owner and **Who has access** to **Anyone**, then deploy.
6. Copy the `/exec` web-app URL for the Vercel environment configuration.

The first authenticated request creates these worksheets when they do not already exist:

- `Registrations` with `registration_id`, `submitted_at`, `registration_type`, `full_name`, `phone`, `email`, `location`, `age`, `gender`, `jacket_size`, `preferred_contact_method`, `status`, and `idempotency_key`.
- `Inventory` with Small 46, Medium 40, Large 2, XL 1, and 2XL 10, plus formulas for claimed, remaining, and available status.

Confirmed visitor rows are the inventory source of truth. Member rows use `recorded` status and never reduce stock. Apps Script holds `LockService.getScriptLock()` while validating duplicates, checking stock, and appending a visitor row.

The page displays Saturday, October 3, 2026 as the registration deadline, but registrations remain open while any jacket size is available. Registration closes when all sizes are fully reserved. Existing `REGISTRATION_CLOSES_AT` environment variables and Script Properties are ignored.

## Vercel configuration

Import the repository into Vercel and add these variables for Production, Preview, and Development as appropriate:

```dotenv
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
CHURCH_PROJECT_SHARED_SECRET=replace-with-a-long-random-secret
APP_TIMEZONE=America/Toronto
ALLOWED_ORIGIN=https://your-domain.example
```

Do not prefix these variables with `VITE_`, `PUBLIC_`, or another client-visible prefix. They must remain server-only. Set `ALLOWED_ORIGIN` to the exact public origin that hosts the form, without a trailing slash. For local full-stack development, use the exact origin printed by `vercel dev`. After changing Apps Script, create a new web-app version and redeploy Vercel if its URL changes.

## API endpoints

- `GET /api/jacket-availability`
- `POST /api/register`
- `POST /api/member-response`

The Vercel layer independently validates input, rejects cross-site browser requests, applies best-effort per-instance rate limits, uses a thirty-second Google timeout within a forty-five-second function limit, and never logs request bodies or secrets. This accommodates slower Google Sheets responses and lock contention. It sends Apps Script `{ action, secret, data }`; availability requests omit `data`. Apps Script authenticates every action and repeats the authoritative validation.

## Commands

| Command                | Description                                        |
| ---------------------- | -------------------------------------------------- |
| `npm run dev`          | Start the frontend-only Vite server                |
| `npm test`             | Run backend, validation, concurrency, and UI tests |
| `npm run format`       | Format supported project files                     |
| `npm run format:check` | Check formatting                                   |
| `npm run lint`         | Run ESLint                                         |
| `npm run typecheck`    | Type-check JavaScript with TypeScript              |
| `npm run build`        | Create the production Vite build                   |

## Important files

- `src/components/RegistrationWizard.jsx` — Typeform-style user experience
- `src/lib/registration.js` — Shared normalization and validation
- `src/lib/submitToGoogleSheet.js` — Same-origin browser API client
- `api/` — Vercel server functions
- `server/vercelApi.js` — Origin, rate-limit, timeout, and Apps Script proxy logic
- `server/registrationCore.js` — Testable inventory and duplicate rules
- `google-apps-script/Code.gs` — Authenticated, concurrency-safe Sheets backend
- `tests/` — Unit, endpoint, Apps Script authentication, and UI-flow tests

Private project for Gospel Pillars Church Toronto. © 2026.
