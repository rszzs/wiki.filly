# Wiki Feyli Security Specification (Phase 0)

## 1. Data Invariants
1. **Master Gate & Parent Integrity:** A `talkMessage` under `/articles/{articleId}/talkMessages/{messageId}` cannot exist unless `/articles/{articleId}` exists.
2. **Identity Integrity:** Every contributor-created document (`pendingRevisions`, `talkMessages`) MUST record `authorUid == request.auth.uid`, and `request.auth.token.email_verified == true`.
3. **Privilege Separation:** Only verified administrators (`new.gov.iq@gmail.com` or UIDs registered in `/admins/{uid}`) may create/edit/delete published `/articles`, manage `/members`, update `/settings/global`, approve/reject `/pendingRevisions`, or write to `/reviewLog` and `/admins`.
4. **No Self-Assigned Roles:** Non-admin contributors cannot set `role: 'moderator'` on talk messages, cannot set `status: 'approved'` when creating a `pendingRevision`, and cannot write `/admins/{uid}`.
5. **Terminal State Locking:** Once a `pendingRevision` transitions to `approved` or `rejected`, non-admin users cannot alter it.
6. **Temporal Integrity:** `createdAt` and `updatedAt` timestamps on Firestore writes are strictly validated against `request.time`.
7. **PII Isolation & Query Enforcement:** `/admins/{uid}` (which may carry email metadata) is readable only by the owning UID or an admin; `/pendingRevisions` and `/reviewLog` list rules enforce `isAdmin() || resource.data.authorUid == request.auth.uid`.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unverified User Write:** Contributor with `email_verified: false` attempts to create a `pendingRevision`.
2. **Identity Spoofing on Pending Revision:** Authenticated user `uidA` attempts to create a `pendingRevision` with `authorUid: "uidB"`.
3. **Self-Approval Escalation:** Non-admin contributor attempts to create a `pendingRevision` with `status: "approved"`.
4. **Ghost Field / Shadow Update:** Contributor sends extra unexpected field `isVerified: true` inside `pendingRevisions` or `talkMessages`.
5. **Poisoned Document ID:** Client attempts to create `/pendingRevisions/bad$id/../../../etc` or >128 char document ID.
6. **Orphaned Talk Message:** Contributor attempts to post to `/articles/non-existent-article/talkMessages/msg1`.
7. **Moderator Role Spoofing on Talk:** Non-admin user posts a `talkMessage` with `role: "moderator"`.
8. **Client-Forged Timestamp:** Contributor submits `createdAt: new Date('2020-01-01')` instead of `serverTimestamp()` (`request.time`).
9. **Unbounded Array Attack:** Write attempts to pass `categories` with >25 items or non-string element `[123]`.
10. **Admin Spoofing / Unverified Admin Email:** User logs in with `email: "new.gov.iq@gmail.com"` and `email_verified: false` and tries to update `/settings/global`.
11. **Direct Article Mutation by Non-Admin:** Regular authenticated user attempts to update or delete `/articles/ghulam-reza-arkawazi`.
12. **Blanket List Scraping:** Non-admin authenticated user runs a collection-wide `getDocs(collection(db, 'pendingRevisions'))` without `where('authorUid', '==', uid)`.
