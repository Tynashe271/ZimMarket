# Security operations

- Private resources are scoped by authenticated customer ownership or server-resolved business membership.
- Branch staff are checked against explicit branch assignments; owners retain all-branch visibility.
- Payment and refund callbacks require HMAC-SHA256 signatures and idempotent records.
- Files use short-lived signed operations, owner/business authorization and a malware-scanner adapter.
- Fraud signals cover brute-force authentication and unusual order volume/value. Extend rules as production history grows.
- `prisma/rls.sql` contains defence-in-depth policy definitions. Enable them only when all API and worker transactions set PostgreSQL session context.
- Replace every `development` provider in production and rotate all secrets.

Run backups with `powershell -File scripts/backup.ps1`. Regularly restore a backup into an isolated database and run `npx prisma migrate status` against it.
