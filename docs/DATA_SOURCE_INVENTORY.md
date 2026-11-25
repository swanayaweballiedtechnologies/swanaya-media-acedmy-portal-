# Swanaya Media Academy — observed data-source inventory

This is a **source-code inventory**, not a live database export. It does not claim to know which records currently exist in Firebase, browser storage, the backend JSON file, or Railway.

## Confirmed from repository source

### Firebase Authentication
- Client auth provider: `src/components/FirebaseAuthProvider.tsx`.
- Firebase project initialization: `src/firebase.ts`.
- Existing Firebase UIDs must remain the identity keys during the first PostgreSQL integration phase.
- Do not export password hashes or attempt to migrate Firebase passwords.

### Firestore collections referenced by `src/services/academyService.ts`
The source contains references to the following collections/documents. Actual collection counts and contents have not been queried.

- `users`
- `courses`
- `course_papers`
- `attendance_qr_sessions`
- `attendance_checkins`
- `class_sessions`
- `admin_grants`
- Document paths/references also include: `blogs`, `media_assets`, `registrations`, `library_posts`, `exam_sessions`, `exam_registrations`, `reviews`, `exam_question_papers`, `mcq_exams`, `exam_submissions`, `exam_announcements`, and `site_settings`.

Some references are direct document reads/writes and not necessarily collection scans. Verify the actual data model and subcollections using a read-only Firestore inventory before migration.

### Browser localStorage
`src/db/mockDb.ts` defines `SwanayaDatabase` and persists many domain records in browser-local keys prefixed with `sma_`, including:

- Users, instructors, students
- Courses, semesters, subjects, lessons, batches
- Classes, attendance, QR attendance sessions and check-ins
- Assignments, submissions, exams, results
- Projects, hackathons and registrations
- Certificates, invoices, payment transactions
- Leads, applications, course registrations, notifications
- Exam announcements, exam sessions/registrations, reviews
- Question papers, MCQ exams, exam submissions, audit logs
- Course categories/modules/credits, tutor allocations, student selections, enrollments, approval logs and tutor progress reports

These keys are scoped to a browser profile/device. They are not automatically a shared central database and may contain records not present in Firestore.

### Backend JSON persistence
`serverAuth.ts` persists custom authentication state in a server-side JSON file under `data/persistent_auth.json`. It includes credential and verification-related state. It must be backed up and treated as sensitive. Do not migrate passwords or verification secrets into PostgreSQL.

### Firebase Storage
`academyService.ts` uses Firebase Storage for uploaded assets/course files. Keep files in place during the relational migration. PostgreSQL should initially store only stable metadata and existing Storage object paths/URLs, not duplicate file bytes.

## Important localStorage safety correction

The old `SwanayaDatabase.init()` path called `clearAllPreloadedData()` on a first-run marker and auto-seeded principal/tutor demo users. That behavior could overwrite local `sma_*` data in a browser with no marker. The integration branch removes that automatic first-run purge and automatic demo-account seeding. The explicit manual restore/clear helpers remain separate and must not be invoked automatically in production.

## What is not known yet

- Actual Firestore project/database collection counts and contents.
- Which localStorage keys contain live records on each user's browser/device.
- Whether backend JSON auth data is used by production users and whether the hosting filesystem is persistent.
- Whether Railway PostgreSQL is empty or contains existing records.
- Which domain currently has the authoritative record if the same entity exists in more than one store.

## Next safe discovery actions

1. Confirm the actual API host/provider and its persistent-disk model.
2. Configure Railway connection credentials only in the backend environment.
3. Run a read-only PostgreSQL schema/count report.
4. Run a read-only Firestore collection/count inventory with the backend service identity.
5. Export/backup Firebase and Railway data and verify restoration before any writes.
6. Ask users/admins to export local browser data from devices where locally stored records may exist; do not silently assume those records exist centrally.
7. Reconcile by stable IDs, Firebase UID, document path and content hash before creating domain tables or copying records.
