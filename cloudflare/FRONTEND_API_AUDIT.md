# Frontend and API Migration Audit

Source inspected: AppDeploy production snapshot `1793813106816` for app `eventara-budaya-pw896v`.
This is an audit only. No production code, database, storage, secrets, or deployment was changed.

## Frontend structure
- React 19 + Vite 6 + TypeScript.
- Main public catalog: `src/App.tsx`.
- Organizer, admin, and superadmin portal: `src/OrganizerPortal.tsx`.
- Styling: `src/index.css`.
- Static logo: `public/resources/eventara-logo.png`.
- Current frontend imports `api` and `auth` from `@appdeploy/client`; this is a migration dependency to remove.
- Package currently does not declare Cloudflare-specific packages or deployment scripts.

## Current API contract observed in backend
### Public
- `GET /api/public/events`
- `GET /api/public/events/archive`
- `GET /api/public/organizers/:id`

### Organizer (authenticated)
- `GET /api/organizer/me`
- `POST /api/organizer/profile`
- `POST /api/organizer/events`
- `PUT /api/organizer/events/:id`
- `POST /api/organizer/events/:id/cancel-request`

### Admin (authenticated)
- `GET /api/admin/events`
- `POST /api/admin/events/:id/review`
- `POST /api/admin/events/:id/cancellation`

### Superadmin (authenticated)
- `GET /api/admin/overview`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `GET /api/admin/audit`

### Access and health
- `GET /api/access/me`
- `GET /api/_healthcheck`

## Frontend behavior to preserve
- Public event catalog, search, category/region/date/ticket filters, pagination.
- Event detail selection and archive listing.
- Nearby event calculation from browser geolocation and event coordinates.
- Organizer sign-in, profile, event draft autosave, create/edit/submit, status history, cancellation request.
- Admin review, revision/rejection, direct cancellation and cancellation request decisions.
- Superadmin overview, admin grant/revoke, audit log.

## Important migration findings
1. `src/App.tsx` declares six sample events in a local `events` array and merges them with published API events (`allEvents = [...events, ...publishedEvents]`). The UI also falls back to sample catalog when API requests fail. Before Cloudflare launch, sample content must be explicitly separated from production catalog so it cannot appear as live event data.
2. Main public catalog and archive currently call the AppDeploy API client.
3. `src/OrganizerPortal.tsx` uses AppDeploy auth for sign-in, getUser and sign-out, and AppDeploy API calls for all organizer/admin/superadmin operations.
4. Backend helper `getAllEvents()` reads only one page with `limit: 100`. The new Cloudflare implementation must use complete queries/pagination; existing public/admin views must not silently truncate after 100 records.
5. The current organizer form supports poster and optional responsibility-letter uploads. User decided these test uploads do not need migration to R2. Keep this out of migration scope unless explicitly requested later.
6. AppDeploy role logic uses email allowlists in secrets plus admin records. Secret values must not be copied to source control. Cloudflare role configuration needs a separate secure setup.
7. Existing AppDeploy `ownerId` values depend on AppDeploy auth user IDs. Cloudflare auth will issue different identities; an explicit legacy-owner mapping is required if existing organizer records are to remain attached to the correct accounts.

## Suggested implementation sequence
1. Create a Cloudflare API client wrapper in the frontend and replace direct `@appdeploy/client` imports only after matching API contracts are implemented.
2. Implement Worker routes matching the API contract above.
3. Implement D1 schema and data access, preserving legacy IDs and owner mapping.
4. Select/configure Cloudflare-compatible authentication and implement role resolution.
5. Add a one-time, verified data import for the four AppDeploy tables. Do not alter the AppDeploy production database.
6. Build and test the frontend against a staging Worker/D1 database before changing production routing.

## Not done
- No actual AppDeploy database rows exported.
- No user accounts migrated.
- No D1 database or R2 bucket created or populated.
- No Cloudflare Worker deployed.
- No AppDeploy production deployment or data mutation performed.
