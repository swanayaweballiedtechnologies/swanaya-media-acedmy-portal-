# Security Specification - Swanaya Media Academy Examination Module

## Data Invariants
1. An Examination must belong to a valid Category.
2. An MCQ Question must belong to an existing Exam.
3. An Exam Result must map to a valid studentId and examId.
4. Answer keys (URLs) must not be accessible to students.
5. Published results are read-only for students.

## Roles
- **Admin**: (Includes SUPER_ADMIN, MD, ADMIN, ACADEMIC_ADMIN) Full CRUD on all collections.
- **Student**: Read access to live exams, write access to their own results (create only), read access to their own published results and certificates.

## The "Dirty Dozen" Payloads (Deny List)
1. **P1 (Identity Spoofing)**: Student trying to create an exam.
2. **P2 (Privilege Escalation)**: Student trying to update their own role in `users` collection.
3. **P3 (Integrity Breach)**: Student trying to update another student's exam result.
4. **P4 (Data Leak)**: Student trying to read MCQ answer keys from the `exams` collection.
5. **P5 (Resource Poisoning)**: Admin trying to upload a 10MB string as an exam title.
6. **P6 (Orphaned Write)**: Student creating a result for a non-existent exam.
7. **P7 (Unauthorized Read)**: Student reading a draft (SCHEDULED) exam questions before start time.
8. **P8 (Bypassing Rules)**: Trying to update `marksObtained` directly without an admin role.
9. **P9 (State Shortcutting)**: Student trying to mark their own exam as 'COMPLETED' before taking it.
10. **P10 (Denial of Wallet)**: Massive array in MCQ options.
11. **P11 (PII Leak)**: Non-admin trying to list all certificates for all students.
12. **P12 (Incorrect Type)**: Sending a boolean instead of an integer for `durationMinutes`.

## Roles Mapping
We will use a `users/{uid}` collection to store roles and an MD-governed `admin_grants/{grantId}` collection to authorize Administrator accounts.
- **MD Authority (`isMd()`)**: Verified bootstrap MD email (`aadithyan.menon@swanayamedia.com`, `swanayamediaenterprisesadmins@gmail.com`, `swanyamediaenterprisesadmins@gmail.com`, `aadithyan@swanayamedia.com`, `aadithyanmmenon@gmail.com`) or `users/{uid}.role in ['MD', 'SUPER_ADMIN']`. Username `aadithyan` resolves strictly to Aadithyan M. Menon (`usr-md`, Managing Director).
- **Admin Check (`isAdmin()`)**: `isAdminEmail()` or `users/{uid}.role in ['MD', 'PRINCIPAL', 'ADMIN', 'SUPER_ADMIN', 'ACADEMIC_ADMIN']` with active status (`status != 'INACTIVE'`).
- **Admin Grants (`admin_grants/{grantId}`)**: Created, updated (suspended/reactivated), and deleted exclusively by the MD. Self-registration is restricted to `STUDENT`, `INSTRUCTOR`, `ALUMNI`, and `PARENT`; an `ADMIN` / `ACADEMIC_ADMIN` user profile can only be created or claimed when backed by an active matching `admin_grants/{grantId}` record.
- **PII & Collection Scoping**: `/users/{userId}` `get`/`list` reads are scoped to the profile owner (`isOwner(userId)` / `resource.data.id == request.auth.uid`) or `isAdmin()`. `/google_meet_meetings/{meetingId}` writes are restricted to `isInstructorOrAdmin()`.
- **Dirty Dozen Addition — Unauthorized Admin Provisioning**: Non-MD users attempting to create `admin_grants/{grantId}`, self-register with `role: 'ADMIN'`, or update their `users/{uid}.role` without an active MD-issued `admin_grants/{grantId}` must be rejected with `PERMISSION_DENIED`.
- **Dirty Dozen Addition — Cross-User PII Scraping**: A non-admin student or tutor attempting to `get` or `list` another user's `/users/{userId}` profile must be rejected with `PERMISSION_DENIED`.

