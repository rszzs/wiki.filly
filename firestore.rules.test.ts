/**
 * Phase 0 Dirty Dozen Security Specification Harness for Wiki Feyli Firestore Rules.
 * Verifies the 12 adversarial payloads against rule invariants (for use with @firebase/rules-unit-testing
 * when running the Firebase Local Emulator Suite).
 */

export interface DirtyDozenScenario {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'delete' | 'get' | 'list';
  expectedResult: 'PERMISSION_DENIED';
  auth: {
    uid: string | null;
    email?: string;
    email_verified?: boolean;
  };
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_SCENARIOS: DirtyDozenScenario[] = [
  {
    id: 1,
    name: 'Unverified user creates pendingRevision',
    collectionPath: 'pendingRevisions/pend_unverified_1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'user-1', email: 'u1@example.com', email_verified: false },
    payload: {
      id: 'pend_unverified_1',
      type: 'edit',
      articleId: 'ghulam-reza-arkawazi',
      articleName: 'غلام رضا خان أركوازي',
      author: 'مستخدم',
      authorUid: 'user-1',
      summary: 'تعديل',
      submittedAt: '2026-11-21 06:50',
      status: 'pending',
      proposedData: { name: 'غلام رضا خان أركوازي' }
    }
  },
  {
    id: 2,
    name: 'Identity spoofing via mismatched authorUid',
    collectionPath: 'pendingRevisions/pend_spoof_2',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'user-1', email: 'u1@example.com', email_verified: true },
    payload: {
      id: 'pend_spoof_2',
      type: 'edit',
      articleId: 'ghulam-reza-arkawazi',
      articleName: 'غلام رضا خان أركوازي',
      author: 'مستخدم',
      authorUid: 'user-victim',
      summary: 'تعديل',
      submittedAt: '2026-11-21 06:50',
      status: 'pending',
      proposedData: { name: 'غلام رضا خان أركوازي' }
    }
  },
  {
    id: 3,
    name: 'Self-approval status escalation on pendingRevision create',
    collectionPath: 'pendingRevisions/pend_escalate_3',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'user-1', email: 'u1@example.com', email_verified: true },
    payload: {
      id: 'pend_escalate_3',
      type: 'edit',
      articleId: 'ghulam-reza-arkawazi',
      articleName: 'غلام رضا خان أركوازي',
      author: 'مستخدم',
      authorUid: 'user-1',
      summary: 'تعديل',
      submittedAt: '2026-11-21 06:50',
      status: 'approved',
      proposedData: { name: 'غلام رضا خان أركوازي' }
    }
  },
  {
    id: 4,
    name: 'Ghost field injection on talkMessage',
    collectionPath: 'articles/ghulam-reza-arkawazi/talkMessages/msg_ghost_4',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'user-1', email: 'u1@example.com', email_verified: true },
    payload: {
      author: 'باحث',
      authorUid: 'user-1',
      role: 'visitor',
      text: 'ملاحظة',
      displayTimestamp: '2026-11-21 06:50',
      isVerified: true
    }
  },
  {
    id: 5,
    name: 'Poisoned invalid document ID with disallowed characters',
    collectionPath: 'pendingRevisions/invalid$id@poison',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'user-1', email: 'u1@example.com', email_verified: true }
  },
  {
    id: 6,
    name: 'Orphaned talk message on non-existent parent article',
    collectionPath: 'articles/non_existent_article/talkMessages/msg_orphan_6',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'user-1', email: 'u1@example.com', email_verified: true },
    payload: {
      author: 'باحث',
      authorUid: 'user-1',
      role: 'visitor',
      text: 'ملاحظة يتيمة',
      displayTimestamp: '2026-11-21 06:50'
    }
  },
  {
    id: 7,
    name: 'Role spoofing as moderator in talk message by non-admin',
    collectionPath: 'articles/ghulam-reza-arkawazi/talkMessages/msg_role_7',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'user-1', email: 'u1@example.com', email_verified: true },
    payload: {
      author: 'باحث',
      authorUid: 'user-1',
      role: 'moderator',
      text: 'تعليق بصلاحية منتحلة',
      displayTimestamp: '2026-11-21 06:50'
    }
  },
  {
    id: 8,
    name: 'Client-forged backdated timestamp on talk message',
    collectionPath: 'articles/ghulam-reza-arkawazi/talkMessages/msg_time_8',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'user-1', email: 'u1@example.com', email_verified: true },
    payload: {
      author: 'باحث',
      authorUid: 'user-1',
      role: 'visitor',
      text: 'توقيت مزور',
      displayTimestamp: '2020-01-01 00:00',
      createdAt: '2020-01-01T00:00:00.000Z'
    }
  },
  {
    id: 9,
    name: 'Unbounded or invalid array element in article categories',
    collectionPath: 'articles/bad_array_9',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'admin-1', email: 'new.gov.iq@gmail.com', email_verified: true },
    payload: {
      id: 'bad_array_9',
      categories: [12345]
    }
  },
  {
    id: 10,
    name: 'Unverified admin email spoof attack on settings/global',
    collectionPath: 'settings/global',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'spoof-admin', email: 'new.gov.iq@gmail.com', email_verified: false },
    payload: {
      siteName: 'اختراق',
      requireMemberApproval: false
    }
  },
  {
    id: 11,
    name: 'Direct article mutation by regular authenticated contributor',
    collectionPath: 'articles/ghulam-reza-arkawazi',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'user-1', email: 'u1@example.com', email_verified: true },
    payload: {
      name: 'تعديل غير مصرح به'
    }
  },
  {
    id: 12,
    name: 'Unfiltered list scraping on pendingRevisions by non-admin',
    collectionPath: 'pendingRevisions',
    operation: 'list',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'user-1', email: 'u1@example.com', email_verified: true }
  }
];
