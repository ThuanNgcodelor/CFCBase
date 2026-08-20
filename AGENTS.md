# BookingBase Agent Instructions

Read this file before changing code in this repository.

## Active Product Scope

- Since 2026-07-27, only the HR management domain is under active product development.
- Booking room/car and Booking approval are legacy/frozen; do not start Booking Phase 6–10 or expand Booking unless the user explicitly reopens that scope.
- Do not delete legacy Booking code, tables, routes, or shared Auth/Notification/PWA infrastructure as part of HR work.
- The canonical active roadmap and system master context is `documents/PROJECT_MASTER_CONTEXT.md`.

## Source Of Truth

1. Current code and config are the source of truth.
2. Current schema/migrations and `clean_database_master.sql` are next.
3. Master Architecture and Business Flow: `documents/PROJECT_MASTER_CONTEXT.md`.

Start by reading:
- `documents/PROJECT_MASTER_CONTEXT.md`

## Hard Rules

- Do not refactor outside the selected task.
- Do not change business flow just to match older design docs.
- Do not change login/profile behavior unless the task explicitly says so.
- Do not expose or log secrets.
- Do not commit real JWT secrets, SMTP passwords, VAPID private keys, DB passwords, OTPs, or Authorization headers.
- Do not move mail or push into the booking transaction.
- Do not cache dynamic booking APIs in the service worker without an invalidation design.
- Do not add Redis/Kafka/queue just because it sounds like a best practice.
- Do not remove backward compatibility unless the task includes migration and tests.

## Security Checklist

Before changing booking, approval, cancel, dashboard, or admin code:
- Requester must come from authenticated principal, not body `requesterId`.
- Approver must come from authenticated principal, not body `approverId`.
- Canceller must come from authenticated principal, not body `cancellerId`.
- Dashboard user data must come from authenticated principal or be admin-authorized.
- Admin APIs must return 403 for non-admin/non-authorized users.
- Protected APIs must return 401 without token.
- CORS must allow configured domains only.
- WebSocket/STOMP CONNECT must validate JWT.

## Booking Checklist

When touching room/car booking:
- Preserve `startTime < endTime` validation.
- Preserve overlap logic: existing start < new end and existing end > new start.
- Preserve locking on room/vehicle before overlap check unless replacing with a proven equivalent.
- Keep blocking statuses as `PENDING` and `APPROVED` unless the task explicitly changes status semantics.
- Test concurrent overlap behavior if transaction/locking changes.

## Notification Checklist

Notification architecture:
- Database notification is the source of truth.
- WebSocket is realtime delivery only.
- Email is independent/fallback channel.
- Web Push is sent only to active subscriptions.

When changing notification:
- Keep notification event handling after commit.
- Mail/push failure must not rollback booking.
- Avoid duplicate notifications by source type/source id.
- Do not retry permanent push failures: 403, 404, 410.
- Log source type/source id and recipient id, but no secrets.

## Frontend Checklist

When changing calendar:
- Keep range-based fetch for month/week/day.
- Test boundary events at start/end of visible range.
- Add stale request guard if changing data fetch.
- Avoid large all-booking loads.
- Use memoization for expensive event mapping/filtering.
- Test mobile portrait/landscape.

When changing routing:
- Do not break deep links from email or push.
- Keep protected route redirect behavior.
- Run `npm.cmd run build`.
- Run `npm.cmd run lint`.

## PWA Checklist

When changing PWA/service worker:
- Verify manifest and maskable icons.
- Do not cache dynamic booking API responses unless invalidation is implemented.
- Test notification click when app is open and closed.
- Test Android install and push.
- Test iOS Add to Home Screen and installed PWA push when possible.
- Check safe-area CSS on iPhone-like screens.

## Backend Checklist

When changing backend:
- Prefer DTOs over direct entity serialization for growing/user-facing APIs.
- Keep transaction boundaries short.
- Do not introduce N+1 queries.
- Add pagination/range filters for large lists.
- Add indexes through migration, not just assumptions.
- Verify important DB changes with `EXPLAIN`.
- Run `.\mvnw.cmd test`.

## Docker/Deploy Checklist

When changing deploy:
- Keep DB data persistent.
- Add or preserve healthchecks and restart policy.
- Use env variables for JWT, mail, VAPID, CORS, frontend URL, DB, timezone.
- Ensure SPA refresh on nested React routes does not 404.
- Verify Cloudflare tunnel points to correct frontend/backend ports.
- Verify HTTPS secure context for PWA push.

## Common Commands

PowerShell may block `npm.ps1`. Prefer:

```powershell
npm.cmd run build
npm.cmd run lint
```

Backend:

```powershell
.\mvnw.cmd test
```

If Maven needs network to download dependencies, ask for approval rather than skipping tests.

## Current Known Baseline

- Frontend build passes with one large main JS chunk around 738 kB minified.
- Frontend lint passes with 5 warnings.
- Backend tests pass: 9 tests.
- Main P0 risks are client-trusted identity and committed secret defaults.
