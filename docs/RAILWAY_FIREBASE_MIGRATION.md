# Swanaya Media Academy — Railway PostgreSQL / Firebase migration runbook

## Confirmed deployment topology

- Frontend: Netlify (public client).
- API: separate Node.js / Express service.
- Existing records and identity: Firebase Authentication, Firestore and Firebase Storage.
- New relational target: Railway PostgreSQL.

## Non-negotiable preservation policy

1. Firebase remains the authoritative source for existing student, course, attendance, examination, fee and user records until each domain has been reconciled and explicitly cut over.
2. Firebase Authentication remains the identity provider in the first phase. Preserve Firebase UIDs as external identity keys; never copy passwords or password hashes into PostgreSQL.
3. Do not delete, overwrite, bulk-update or disable Firebase data during discovery or first migration.
4. Do not run destructive SQL (DROP, TRUNCATE, DELETE, table rewrites) as part of this integration.
5. Back up Firestore exports and Railway PostgreSQL before any migration write. Verify that backups can be restored.
6. The new `sma_integration` schema is isolated metadata only. No academic table is created until the actual Firestore collections and external PostgreSQL schema have been inventoried.

## Railway connection configuration

Set secrets only on the **Node.js backend service**, never in Netlify client variables or any `VITE_*` variable:

- `DATABASE_URL`: Railway PostgreSQL connection URL.
- `PGSSLMODE=require`: require TLS for production connections.
- `PGPOOL_MAX=5`: conservative initial connection-pool size.
- `NODE_ENV=production`.

If the Node backend runs in the same Railway project and environment as PostgreSQL, prefer Railway's private `DATABASE_URL` reference. If the backend is hosted outside Railway, use the Railway TCP Proxy / external connection URL and require TLS. Never put either URL in frontend build-time environment variables.

Railway documents the PostgreSQL connection variables and the distinction between private service networking and external TCP Proxy access:
- https://docs.railway.com/databases/postgresql
- https://docs.railway.com/platform/best-practices
- https://docs.railway.com/variables

## Phase 0 — inventory only (no writes)

Before applying SQL or copying records, record:
- Firebase project ID and Firestore database ID (not private credentials).
- Collection names, document counts, document ID patterns and field shapes.
- Storage buckets and file ownership/reference patterns.
- Firebase Auth user count and UID/email/verification/disabled status (never export passwords).
- Railway database name, PostgreSQL version, schemas, tables, columns, indexes, constraints, roles and approximate row counts.
- Current API host, public API origin, Netlify site origin and CORS allow-list.

Use read-only inspection. Do not paste credentials, service-account JSON, private keys or connection URLs into chat or commit them to Git.

## Phase 1 — backup and restore verification

- Export Firestore using the supported Firebase/GCP export procedure to a protected bucket.
- Take a Railway backup/snapshot or a `pg_dump` backup.
- Store backups outside the application repository with restricted access.
- Record export timestamps and counts.
- Restore both backups into isolated test projects/databases and verify counts before proceeding.

## Phase 2 — metadata migration

The SQL file `db/migrations/0001_sma_integration_metadata.sql` creates only:
- `sma_integration.schema_migrations`
- `sma_integration.firebase_document_map`
- `sma_integration.sync_runs`

It does not copy or alter existing academy data. Review it against the target database first, then apply manually only after a verified backup.

## Phase 3 — domain-by-domain copy

Recommended order:
1. User/profile identity mapping (Firebase UID retained).
2. Departments, programmes, courses and course mappings.
3. Students, admissions and enrollments.
4. Tutors, HOD assignments and course allocations.
5. Attendance and class schedules.
6. Assignments, submissions, examinations, marks and results.
7. Fees, invoices, payment transactions and receipts.
8. Certificates, alumni and audit records.

For every batch:
- Read from Firebase.
- Normalize without mutating source documents.
- Upsert to a new, isolated PostgreSQL target table using stable source IDs.
- Store a payload hash and source update timestamp.
- Compare source/target counts and hashes.
- Record conflicts for manual review; never silently overwrite a newer record.
- Mark records VERIFIED only after reconciliation.

Do not enable application dual-writes until idempotency, retry handling, ordering and conflict resolution are implemented and tested.

## Phase 4 — application cutover

- Add server-side repository adapters behind existing service interfaces.
- Keep Firebase Auth and Firebase Storage active.
- Route reads to PostgreSQL only for a domain whose migration has passed reconciliation.
- Keep a controlled fallback/read-only Firebase copy during the agreed rollback window.
- Enforce authorization in Express middleware using verified Firebase ID tokens / server sessions and database-backed role assignments. Never trust a role sent by the browser.
- Scope HOD, tutor, finance and student queries to their assigned department, course or own student identity.

## Phase 5 — validation

Test existing sign-in and account recovery first, then each role and module:
- MD/Admin, HOD, Tutor, Student, Finance and Alumni.
- Registration, approval and course allocation.
- Attendance, materials, assignments and examination submissions.
- Marks/results, fees/receipts and certificates.
- Audit logging and access-denial cases.

Production cutover requires passing tests, verified backup restoration, reconciliation reports and explicit approval.

## Current scaffold behavior

- `server/db/postgres.ts` creates a lazy connection pool only when `DATABASE_URL` is configured.
- `GET /api/health/postgres` performs a read-only `SELECT 1` connectivity check.
- No automatic migration runner, Firebase export, record copy, or production cutover is triggered.
