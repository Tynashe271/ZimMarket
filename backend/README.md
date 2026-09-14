# ZimMarket backend

NestJS API for a multi-tenant marketplace using PostgreSQL, Prisma and Redis/BullMQ.

## Run locally

```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma migrate dev --name init
npm run start:dev
```

Swagger is at `http://localhost:3000/docs`; health is at `GET /api/v1/health`.

For a complete backend-only local demonstration—including mock notifications, files, maps, payments and seeded accounts—see [DEMO.md](DEMO.md).

## Initial API

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/public/products` (safe public fields only)
- `GET /api/v1/businesses/:businessId/products` (membership required)
- `POST /api/v1/businesses/:businessId/products` (owner/manager/inventory role required)

Business scope comes from the authenticated user's membership. A client-supplied business ID is never trusted by itself.

## Implemented domains

- Authentication: registration, login, rotating refresh tokens, session listing/revocation, lockout and verification codes.
- Businesses: business creation, owner membership and role-scoped operations.
- Catalog: private inventory and safe public product projections.
- Advertising: submission, public active ads and admin moderation.
- Orders: customer-only checkout, atomic stock decrement, price snapshots and validated status transitions.
- Messaging: customer/business conversations with membership checks on every read and write.
- Finance: idempotent payment initiation, signed webhooks, double-entry ledger records and permission-gated payouts.
- Trust: KYC document records, moderation, abuse reports and sensitive-action audit logs.
- Privacy: account export, session revocation and safe account anonymization.
- Jobs: Redis/BullMQ notification delivery with retries and exponential backoff.

## Zimbabwe marketplace expansion

- Multi-branch management with branch-assigned staff, delivery areas and operating hours.
- Point-of-sale sales with atomic synchronization of branch and online inventory.
- Customer product/service requests and private business quotations; competitors never receive each other's offers.
- Service catalog, collision-checked appointments and booking status management.
- Delivery methods, minimal courier data and privacy-safe public tracking.
- Verified-purchase reviews, moderation, disputes, evidence and support tickets.
- Business verification levels and community discovery tags.
- Invitation-only wholesale offers between approved businesses.
- Store-specific loyalty programs, points structures and vouchers.
- Customer product follows, price-drop jobs and time-limited branch reservations.
- Currency-specific product prices and business-supported currencies.
- Diaspora buyer/recipient separation and immutable order invoice snapshots.
- Subscription plans from Free through Enterprise.
- Customer recommendations and aggregated 30-day demand/branch/online-sales insights.
- Customer-only storefront access; business accounts can see public ads but cannot enter competitor storefronts.

Low-data/offline presentation and image compression are client/CDN responsibilities. The backend supplies compact field projections and queued notifications so clients do not need constant polling.

External SMS, email, payment and object-storage vendors are adapter boundaries. Development verification codes are returned only when `NODE_ENV=development`.

## Production hardening

- Subscription limits and feature gates are enforced server-side.
- Refunds require customer ownership, business finance approval and a signed provider callback; ledger reversals are balanced.
- Courier profiles must be approved by each business and receive only fulfillment-minimum delivery fields.
- Fraud signals are created for brute-force login activity and unusual order volume/value, with an admin review queue.
- Storage upload/download operations are short-lived and signed; document registration passes through a malware-scanner adapter.
- SMS, email, WhatsApp, maps, accounting and storage use replaceable provider gateways configured through environment variables.
- Reports support online/POS totals, branches, currencies, products, refunds, staff activity and export adapters.
- Referral rewards, delivered-order loyalty points and scheduled birthday scans run through the loyalty/job system.
- Prometheus-compatible process metrics are exposed at `GET /api/v1/health/metrics`.
- Database backup tooling is available at `scripts/backup.ps1`; PostgreSQL defence-in-depth policy definitions are in `prisma/rls.sql`.

## Verification

```bash
npm run build
npm test -- --runInBand
npx prisma migrate status
```
