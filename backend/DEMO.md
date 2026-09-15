# Backend demo providers

The demo requires only PostgreSQL and Redis. It does not require a frontend or third-party accounts.

```powershell
Copy-Item .env.example .env  # only when .env does not already exist
podman compose up -d
npx prisma migrate deploy
npm run db:seed
npm run start:dev
```

Seeded accounts use `DEMO_ADMIN_PASSWORD` (default: `ChangeMe123!`):

- `admin@zimmarket.local`
- `owner@zimmarket.local`
- `customer@zimmarket.local`

Change the password environment variable outside local development.

## Demo provider behavior

- SMS, email and WhatsApp messages are persisted in `NotificationOutbox`. Admins inspect them with `GET /api/v1/demo/outbox`.
- `POST /api/v1/documents/upload-url` and `GET /api/v1/documents/:id/download-url` issue expiring HMAC-signed local-storage URLs.
- Files are stored under `.data/storage`, capped at 10 MB, path-confined, SHA-256 hashed and checked for blocked executable types and the EICAR test signature.
- `POST /api/v1/demo/maps/geocode` returns deterministic coordinates inside Zimbabwe for repeatable testing.
- Customers complete mock payments at `POST /api/v1/finance/demo/payments/:id/complete`.
- Customers complete approved mock refunds at `POST /api/v1/finance/demo/refunds/:id/complete`.
- Accounting exports return internal JSON or CSV payloads.
- Admins inspect provider health/history at `GET /api/v1/demo/providers/status`.

Mock payment and refund endpoints reject requests when `NODE_ENV=production`. Signed webhooks remain the integration path for real payment providers.

## Replacing a demo provider

Implement the corresponding operation in [provider.gateway.ts](src/providers/provider.gateway.ts), set its provider environment variable, and preserve the method contract. Business modules do not need to change.

| Demo capability | Environment setting |
|---|---|
| SMS | `SMS_PROVIDER` |
| Email | `EMAIL_PROVIDER` |
| WhatsApp | `WHATSAPP_PROVIDER` |
| Malware scanning | `MALWARE_SCANNER` |
| Maps/geocoding | `MAPS_PROVIDER` |
| Accounting | `ACCOUNTING_PROVIDER` |
| Storage location | `LOCAL_STORAGE_PATH` |
