# 826 Masonic Avenue

A Notion-style house listing, centered photo spotlight, interest form, and one central applications database. House pictures include all original document photos and the additional front-door photo.

## Local setup

Node 24 is required.

```sh
npm ci
cp .env.example .env.local
# Set ADMIN_PASSWORD to the one shared password you want to use.
npm run dev
```

Open http://localhost:3000. Visit `/admin`, enter the shared password, and view applications, filter by name/phone/status, update statuses, add notes, or download a CSV. The CSV includes **all matching responses**, including original applicant notes, current status, and internal notes. `/responses` redirects to `/admin`.

The listing and form are public. `/admin` and the data API use the **same shared password**, with no accounts, roles, or separate API keys. Browser sign-in lasts eight hours. An agent uses that same password in an `Authorization: Bearer ...` header.

## Render deployment

Create a Blueprint from this private repository's `main` branch. `render.yaml` declares one **paid Starter Node service** and a **1 GB persistent disk**. Review Render's current cost before applying the Blueprint. Enter the shared `ADMIN_PASSWORD` when prompted.

- Build: `npm ci --include=dev && npm run build`
- Start: `npm start` (uses Render's `PORT`)
- Health check: `/api/health`
- Persistent data: `/var/data/applications.sqlite`
- Admin: `/admin`

The database and activity history survive restarts and redeploys. Keep the disk attached; Render's ordinary filesystem is ephemeral. This is a single-instance SQLite deployment. The existing ChatGPT Sites preview remains a separate deployment, with its own database. The Render version becomes the central source of truth once traffic is directed to it.

Optionally set `PUBLIC_SITE_URL` to the canonical HTTPS origin if you use a custom domain. Render's own external URL is otherwise detected automatically.

References: [Next.js on Render](https://render.com/docs/deploy-nextjs-app), [persistent disks](https://render.com/docs/disks), [Blueprints](https://render.com/docs/blueprint-spec).

## Simple agent API

Set `HOUSE_URL` to your Render origin and `ADMIN_PASSWORD` to your shared password. The OpenAPI specification is available at `/openapi.json`.

| Method | Endpoint                       | Use                                                     |
| ------ | ------------------------------ | ------------------------------------------------------- |
| GET    | `/api/applications`            | List all interest, with optional filters and pagination |
| GET    | `/api/applications/{id}`       | One response and its update history                     |
| PATCH  | `/api/applications/{id}`       | Change status, append a note, or update metadata        |
| POST   | `/api/applications/{id}/notes` | Add a note                                              |
| GET    | `/api/applications/export`     | Download matching responses as CSV                      |

```sh
# Query new interest. Also supports room=A, room=B, room=both and q=name-or-phone.
curl --fail-with-body "$HOUSE_URL/api/applications?status=new&limit=50" \
  -H "Authorization: Bearer $ADMIN_PASSWORD"

# Mark someone no longer interested; no preliminary request is required.
curl --fail-with-body -X PATCH "$HOUSE_URL/api/applications/$APPLICATION_ID" \
  -H "Authorization: Bearer $ADMIN_PASSWORD" \
  -H 'Content-Type: application/json' \
  --data '{"status":"no_longer_interested","note":"Withdrew by phone."}'

# Add information without changing status.
curl --fail-with-body -X POST "$HOUSE_URL/api/applications/$APPLICATION_ID/notes" \
  -H "Authorization: Bearer $ADMIN_PASSWORD" \
  -H 'Content-Type: application/json' \
  --data '{"text":"Would like to visit next Tuesday."}'
```

Statuses: `new`, `contacted`, `viewing_scheduled`, `viewed`, `offered`, `accepted`, `declined`, `no_longer_interested`.

PATCH also accepts a `metadata` object for structured information, e.g. `{"metadata":{"viewingDate":"2026-12-02"}}`. It merges top-level keys. Every update is saved in the history. Original applicant notes stay separate from internal notes.

Pagination uses `limit` (1–100), `offset`, and the returned `nextOffset`. Repeat with `nextOffset` until it is null. A room A/B filter also includes people who chose both. Search matches name or phone. `X-Agent-Name` is an optional label for history entries.

`expectedVersion` is optional. Most programs can omit it. Programs that need conflict detection can pass the current `application.version` and receive HTTP 409 if another update occurred.

A dependency-free Python client is included:

```sh
python3 scripts/applications-client.py list --status new
python3 scripts/applications-client.py get APPLICATION_ID
python3 scripts/applications-client.py update APPLICATION_ID --status no_longer_interested --note 'Withdrew.'
python3 scripts/applications-client.py note APPLICATION_ID 'Follow up next week.'
```

## Existing responses

The preview was checked during setup and had **zero responses** at that time. Later responses to the old preview are not copied automatically. If needed, run the included import on the destination Render service, where its disk is mounted:

```sh
npm run db:import -- /path/to/responses.json
```

Input format: `{"rows":[...]}`. IDs and submission times are preserved; previously imported IDs are skipped. Alternatively configure `SOURCE_RESPONSES_URL`, `SOURCE_RESPONSES_KEY`, and `SOURCE_SITES_TOKEN` for a private original preview, then run `npm run db:import`. Remove temporary source credentials afterward. Data exports are excluded from Git.

## Verify

```sh
npm test
npx tsc --noEmit
npm run build
```
