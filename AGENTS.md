# ZimMarket Project Information

## Project Structure
- `backend/` — NestJS, Prisma, PostgreSQL and Redis API
- `frontend/` — Next.js, React, TypeScript and Tailwind CSS customer marketplace

## Running the Project

### Backend
```powershell
cd backend
docker compose up -d
npm install
npx prisma migrate dev
npm run db:seed
npm run start:dev
```

### Frontend
```powershell
cd frontend
npm install
npm run dev
```

### Access Points
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- Swagger Docs: http://localhost:3000/docs
- Health Check: http://localhost:3000/api/v1/health

## Configuration Notes

### Port Conflicts Fixed
- Redis port changed from 6379 to 6380 (due to existing Redis instance)
- PostgreSQL port changed from 5433 to 5434 (due to existing PostgreSQL instance)
- Updated in `backend/docker-compose.yml` and `backend/.env`

### Environment Variables
- Backend `.env` contains database URLs, JWT secrets, and CORS settings
- Frontend `.env` contains BACKEND_URL and optional NEXT_PUBLIC_API_URL

## Verification Commands
- Backend build: `cd backend && npm run build`
- Backend lint: `cd backend && npm run lint`
- Frontend build: `cd frontend && npm run build`
- Frontend typecheck: `cd frontend && npm run typecheck`

## Key Features Implemented
- Multi-tenant marketplace with authentication
- Business management with role-based access
- Product catalog and inventory management
- Order processing with real Paynow Zimbabwe gateway integration (EcoCash, OneMoney, cards, bank transfer via Paynow's hosted checkout), plus a `development`-mode simulator for local work — see `backend/src/finance/paynow.provider.ts` and `PAYMENT_PROVIDER` in `.env.example`
- Messaging system between customers and businesses
- Document management with malware scanning
- Subscription plans and feature gates
- Zimbabwe-specific features (fiscalisation, multi-branch, delivery)
- **Comprehensive ZIMRA compliance system with automated verification, expiry reminders, and store restrictions**

## Next.js Version Notes
- This project uses Next.js 16.3.2 which has breaking changes from earlier versions
- Always consult `node_modules/next/dist/docs/` before making changes
- The App Router is used with Server Components and new React features
- Client components use 'use client' directive

## Compliance System
The ZimMarket platform includes a comprehensive ZIMRA compliance system:

### Compliance Statuses
- `DRAFT` - Application is incomplete
- `PENDING_VERIFICATION` - Evidence submitted for review
- `CHANGES_REQUIRED` - Information is incorrect or missing
- `COMPLIANT` - Required checks passed
- `EXPIRING_SOON` - Certificate is near expiry
- `EXPIRED` - Certificate has expired
- `DEVICE_INACTIVE` - Fiscal device is not active
- `SUSPENDED` - Serious compliance or policy problem
- `UNDER_REVIEW` - Compliance is being investigated

### Compliance Checks
- ZIMRA tax registration verification
- Fiscalisation status verification
- Tax Clearance Certificate validation
- Receipt verification via FDMS

### Features
- Automated verification via ZIMRA API (when configured)
- Manual verification workflow for administrators
- Expiry reminder system (30, 14, 7, 3, 1 days before expiry)
- Store restrictions when compliance expires
- Audit logging for all compliance actions
- Renewal workflow for expired certificates
- Separate tracking of tax clearance, fiscal device, and taxpayer status

### Frontend
- Compliance management page at `/business/compliance`
- Document upload interface
- Status overview with detailed information
- Restriction display and management
- Renewal submission interface

### Backend Modules
- `compliance` - Main compliance module
- `compliance-reminder` - Scheduled expiry reminders
- `store-restriction` - Trading restriction enforcement
- `compliance-audit` - Compliance action logging
- `zimra-integration` - ZIMRA API integration
