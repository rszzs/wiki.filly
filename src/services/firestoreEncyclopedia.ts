import { User } from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { NEW_PROFILE_ARTICLE_IDS } from '../data/feyliProfilesData';
import {
  DEFAULT_MEMBERS,
  DEFAULT_SYSTEM_SETTINGS,
  INITIAL_ARTICLES,
  INITIAL_PENDING_REVISIONS
} from '../data/initialEncyclopedia';
import { OperationType, db, handleFirestoreError } from '../firebase';
import {
  AccentTone,
  Article,
  ArticleDailyBucket,
  ArticleMetricRecord,
  ArticleSnapshot,
  ArticleType,
  EncyclopediaState,
  MemberAccount,
  PendingRevision,
  ProtectionLevel,
  RevisionSnapshot,
  SystemSettings,
  TalkMessage,
  WikiPortal,
  formatPersonLifespan,
  inferArticleType
} from '../types/encyclopedia';
import { MAX_IMAGE_URL_LENGTH, computeInitials, sanitizeImageUrl } from '../utils/storage';

export const BOOTSTRAPPED_ADMIN_EMAILS = ['new.gov.iq@gmail.com', 's3nabarqe@gmail.com'];
const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

const VALID_PORTALS: WikiPortal[] = [
  'شخصيات وأعلام',
  'عشائر وأنساب',
  'فنون وثقافة',
  'أماكن ومدن',
  'أحداث تاريخية',
  'إعلام وسياسة'
];

const VALID_PROTECTIONS: ProtectionLevel[] = ['semi-protected', 'strict-review', 'open'];
const VALID_ACCENTS: AccentTone[] = ['lapis', 'bronze', 'forest', 'terracotta'];
const VALID_ARTICLE_TYPES: ArticleType[] = ['person', 'place', 'general'];

const LEGACY_DOC_DIRECTOR_NAME = 'د. كاظم حبيب (مدير التوثيق)';
const CURRENT_DOC_DIRECTOR_NAME = 'رعد صباح (مدير التوثيق)';

function normalizeSupervisorName(value: string): string {
  return value === LEGACY_DOC_DIRECTOR_NAME ? CURRENT_DOC_DIRECTOR_NAME : value;
}

function normalizeSupervisorList(list: string[]): string[] {
  return Array.from(new Set(list.map((item) => normalizeSupervisorName(item))));
}

function normalizeRevisionHistoryNames(history: RevisionSnapshot[]): RevisionSnapshot[] {
  return history.map((rev) => ({
    ...rev,
    author: normalizeSupervisorName(rev.author),
    ...(rev.approver ? { approver: normalizeSupervisorName(rev.approver) } : {})
  }));
}

function clampStr(val: unknown, maxLen: number, fallback = ''): string {
  const s = typeof val === 'string' ? val.trim() : fallback;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function clampMinMax(val: unknown, minLen: number, maxLen: number, fallback: string): string {
  const s = clampStr(val, maxLen, fallback);
  return s.length >= minLen ? s : fallback.slice(0, maxLen);
}

export function sanitizeFirestoreId(raw: string, fallbackPrefix = 'item'): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 120);
  if (cleaned.length >= 2 && ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return `${fallbackPrefix}-${Date.now()}`;
}

export function sanitizeArticleSnapshot(snap: ArticleSnapshot): ArticleSnapshot {
  const portal: WikiPortal = VALID_PORTALS.includes(snap.portal)
    ? snap.portal
    : 'شخصيات وأعلام';

  const articleType: ArticleType =
    snap.articleType && VALID_ARTICLE_TYPES.includes(snap.articleType)
      ? snap.articleType
      : inferArticleType({ ...snap, portal });

  const cleanBirthDate = articleType === 'person' ? clampStr(snap.birthDate, 80) : '';
  const cleanDeathDate = articleType === 'person' ? clampStr(snap.deathDate, 80) : '';
  const cleanBirthDeath =
    articleType === 'person'
      ? clampStr(
          formatPersonLifespan({
            birthDate: cleanBirthDate,
            deathDate: cleanDeathDate,
            birthDeath: snap.birthDeath
          }),
          160
        )
      : '';
  const cleanBirthplace = articleType === 'person' ? clampStr(snap.birthplace, 240) : '';
  const cleanClanAffiliation =
    articleType === 'person' ? clampStr(snap.clanAffiliation, 160) : '';

  const cleanGeographicLocation =
    articleType === 'place' ? clampStr(snap.geographicLocation, 300) : '';
  const cleanAdministrativeRegion =
    articleType === 'place' ? clampStr(snap.administrativeRegion, 240) : '';
  const cleanCoordinates = articleType === 'place' ? clampStr(snap.coordinates, 80) : '';
  const cleanPopulationEstimate =
    articleType === 'place' ? clampStr(snap.populationEstimate, 160) : '';
  const cleanRelatedClans = articleType === 'place' ? clampStr(snap.relatedClans, 400) : '';
  const cleanHistoricalEra =
    articleType === 'general' ? clampStr(snap.historicalEra, 160) : '';

  const result: ArticleSnapshot = {
    name: clampMinMax(snap.name, 2, 200, 'مقالة بدون عنوان'),
    subtitle: clampStr(snap.subtitle, 300),
    portal,
    articleType,
    summary: clampMinMax(snap.summary, 5, 8000, 'نص تعريفي موسوعي'),
    field: clampMinMax(snap.field, 2, 200, 'التراث الفيلي'),
    activeYears: clampStr(snap.activeYears, 160),
    birthDate: cleanBirthDate,
    deathDate: cleanDeathDate,
    birthDeath: cleanBirthDeath,
    birthplace: cleanBirthplace,
    clanAffiliation: cleanClanAffiliation,
    geographicLocation: cleanGeographicLocation,
    administrativeRegion: cleanAdministrativeRegion,
    coordinates: cleanCoordinates,
    populationEstimate: cleanPopulationEstimate,
    relatedClans: cleanRelatedClans,
    historicalEra: cleanHistoricalEra,
    notableWorks: clampStr(snap.notableWorks, 400),
    categories: (Array.isArray(snap.categories) ? snap.categories : [])
      .map((c) => clampStr(c, 100))
      .filter(Boolean)
      .slice(0, 20),
    sections: (Array.isArray(snap.sections) ? snap.sections : [])
      .slice(0, 40)
      .map((s, idx) => ({
        id: sanitizeFirestoreId(s.id || `sec-${idx + 1}`, 'sec'),
        title: clampStr(s.title, 200, `قسم ${idx + 1}`) || `قسم ${idx + 1}`,
        content: clampStr(s.content, 16000)
      })),
    references: (Array.isArray(snap.references) ? snap.references : [])
      .slice(0, 60)
      .map((r, idx) => ({
        id: typeof r.id === 'number' ? r.id : idx + 1,
        text: clampStr(r.text, 1000)
      }))
  };

  if (Array.isArray(snap.subcategories)) {
    result.subcategories = Array.from(
      new Set(
        snap.subcategories
          .map((s) => clampStr(s, 100))
          .filter(Boolean)
      )
    ).slice(0, 20);
  }

  if (typeof snap.isStub === 'boolean') {
    result.isStub = snap.isStub;
  }

  if (typeof snap.needsSources === 'boolean') {
    result.needsSources = snap.needsSources;
  }

  if (typeof snap.isFeatured === 'boolean') {
    result.isFeatured = snap.isFeatured;
  }

  if (Array.isArray(snap.infoboxRows) && snap.infoboxRows.length > 0) {
    result.infoboxRows = snap.infoboxRows.slice(0, 20).map((row) => ({
      label: clampStr(row.label, 100),
      value: clampStr(row.value, 1000)
    }));
  }

  const safeImg = sanitizeImageUrl(snap.imageUrl);
  if (safeImg && safeImg.length <= MAX_IMAGE_URL_LENGTH) {
    result.imageUrl = safeImg;
  } else if (snap.imageUrl !== undefined) {
    result.imageUrl = '';
  }

  if (typeof snap.imageCaption === 'string') {
    result.imageCaption = clampStr(snap.imageCaption, 300);
  }

  return result;
}

function sanitizeHistoryList(history: RevisionSnapshot[]): RevisionSnapshot[] {
  return (Array.isArray(history) ? history : []).slice(-100).map((rev, idx) => {
    const cleaned: RevisionSnapshot = {
      id: sanitizeFirestoreId(rev.id || `rev-${idx + 1}`, 'rev'),
      timestamp: clampStr(rev.timestamp, 32),
      author: clampStr(rev.author, 120, 'هيئة التحرير') || 'هيئة التحرير',
      summary: clampStr(rev.summary, 500),
      snapshot: sanitizeArticleSnapshot(rev.snapshot)
    };
    if (rev.approver) cleaned.approver = clampStr(rev.approver, 120);
    if (rev.status) cleaned.status = rev.status;
    if (rev.rejectReason) cleaned.rejectReason = clampStr(rev.rejectReason, 500);
    return cleaned;
  });
}

function buildArticleCreateDoc(article: Article) {
  const id = sanitizeFirestoreId(article.id, 'entry');
  const cleanSnap = sanitizeArticleSnapshot(article);
  return {
    ...cleanSnap,
    id,
    initials: clampStr(article.initials || computeInitials(cleanSnap.name), 16) || 'ف',
    accentTone: VALID_ACCENTS.includes(article.accentTone) ? article.accentTone : 'lapis',
    updatedAt: clampStr(article.updatedAt, 32),
    protectionLevel: VALID_PROTECTIONS.includes(article.protectionLevel)
      ? article.protectionLevel
      : 'semi-protected',
    designatedApprovers: (Array.isArray(article.designatedApprovers)
      ? article.designatedApprovers
      : []
    )
      .map((a) => clampStr(a, 120))
      .filter(Boolean)
      .slice(0, 20),
    history: sanitizeHistoryList(article.history),
    createdAt: serverTimestamp(),
    updatedAtServer: serverTimestamp()
  };
}

function formatFirestoreTimestamp(ts: unknown, fallback = ''): string {
  if (ts instanceof Timestamp) {
    const d = ts.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  }
  return typeof ts === 'string' ? ts : fallback;
}

export async function checkIsUserAdmin(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (user.email && BOOTSTRAPPED_ADMIN_EMAILS.includes(user.email)) return true;

  const path = `admins/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return false;
  }
}

let activeSeedPromise: Promise<boolean> | null = null;

export async function seedInitialFirestoreDataIfEmpty(adminUser: User): Promise<boolean> {
  if (activeSeedPromise) {
    return activeSeedPromise;
  }

  activeSeedPromise = (async () => {
    try {
      const existingArticles = await getDocs(collection(db, 'articles'));
      if (!existingArticles.empty) {
        return false;
      }

      // Batch 1: Core parent documents (/articles, /members, /settings/global)
      const coreBatch = writeBatch(db);

      for (const art of INITIAL_ARTICLES) {
        const id = sanitizeFirestoreId(art.id, 'entry');
        coreBatch.set(doc(db, 'articles', id), buildArticleCreateDoc({ ...art, id }));
      }

      for (const mem of DEFAULT_MEMBERS) {
        const memId = sanitizeFirestoreId(mem.id, 'mem');
        coreBatch.set(doc(db, 'members', memId), {
          id: memId,
          name: clampMinMax(mem.name, 2, 120, 'مشرف تحرير'),
          roleTitle: clampMinMax(mem.roleTitle, 2, 100, 'مشرف'),
          specialty: clampMinMax(mem.specialty, 2, 160, 'التراث الفيلي'),
          status: mem.status === 'suspended' ? 'suspended' : 'active',
          joinedAt: clampStr(mem.joinedAt, 32),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      coreBatch.set(doc(db, 'settings', 'global'), {
        siteName: clampMinMax(DEFAULT_SYSTEM_SETTINGS.siteName, 2, 120, 'ويكي فيلي'),
        siteSubtitle: clampStr(DEFAULT_SYSTEM_SETTINGS.siteSubtitle, 300),
        requireMemberApproval: Boolean(DEFAULT_SYSTEM_SETTINGS.requireMemberApproval),
        allowImageUrls: Boolean(DEFAULT_SYSTEM_SETTINGS.allowImageUrls),
        defaultProtectionLevel: DEFAULT_SYSTEM_SETTINGS.defaultProtectionLevel,
        announcementBanner: clampStr(DEFAULT_SYSTEM_SETTINGS.announcementBanner, 600),
        updatedAt: serverTimestamp()
      });

      await coreBatch.commit();

      // Batch 2: Dependent documents referencing /articles/{id} (/talkMessages and /pendingRevisions)
      const secondaryBatch = writeBatch(db);
      let secondaryCount = 0;

      for (const art of INITIAL_ARTICLES) {
        const id = sanitizeFirestoreId(art.id, 'entry');
        for (const msg of art.talkMessages) {
          const msgId = sanitizeFirestoreId(msg.id, 'talk');
          secondaryBatch.set(doc(db, 'articles', id, 'talkMessages', msgId), {
            author: clampMinMax(msg.author, 1, 120, 'باحث'),
            authorUid: adminUser.uid,
            role: msg.role === 'moderator' ? 'moderator' : 'visitor',
            topic: clampStr(msg.topic, 200),
            text: clampMinMax(msg.text, 2, 4000, 'ملاحظة توثيقية'),
            displayTimestamp: clampStr(msg.createdAt, 32),
            createdAt: serverTimestamp()
          });
          secondaryCount += 1;
        }
      }

      for (const rev of INITIAL_PENDING_REVISIONS) {
        const revId = sanitizeFirestoreId(rev.id, 'pend');
        secondaryBatch.set(doc(db, 'pendingRevisions', revId), {
          id: revId,
          type: rev.type,
          articleId: sanitizeFirestoreId(rev.articleId, 'entry'),
          articleName: clampMinMax(rev.articleName, 2, 200, 'مقالة موسوعية'),
          author: clampMinMax(rev.author, 1, 120, 'باحث مساهم'),
          authorUid: adminUser.uid,
          summary: clampMinMax(rev.summary, 2, 500, 'مساهمة توثيقية'),
          submittedAt: clampStr(rev.submittedAt, 32),
          status: 'pending',
          proposedData: sanitizeArticleSnapshot(rev.proposedData),
          ...(rev.originalData ? { originalData: sanitizeArticleSnapshot(rev.originalData) } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        secondaryCount += 1;
      }

      if (secondaryCount > 0) {
        await secondaryBatch.commit();
      }

      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'articles');
    } finally {
      activeSeedPromise = null;
    }
  })();

  return activeSeedPromise;
}

export const BUILT_IN_SYNC_ARTICLE_IDS: string[] = [
  'arkawazi-tribe',
  'raad-sabah-zangana',
  'sabah-zangana',
  ...NEW_PROFILE_ARTICLE_IDS
];

export async function syncMissingBuiltInArticlesForAdmin(
  existingIds: string[]
): Promise<number> {
  const missing = INITIAL_ARTICLES.filter(
    (art) => BUILT_IN_SYNC_ARTICLE_IDS.includes(art.id) && !existingIds.includes(art.id)
  );
  if (missing.length === 0) return 0;

  const batch = writeBatch(db);
  for (const art of missing) {
    const id = sanitizeFirestoreId(art.id, 'entry');
    batch.set(doc(db, 'articles', id), buildArticleCreateDoc({ ...art, id }));
  }

  try {
    await batch.commit();
    return missing.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'articles');
  }
}

export async function migrateSupervisorNameInFirestore(): Promise<number> {
  let updatedCount = 0;

  try {
    const batch = writeBatch(db);

    const membersSnap = await getDocs(collection(db, 'members'));
    membersSnap.docs.forEach((docSnap) => {
      const d = docSnap.data() as Record<string, unknown>;
      if (d.name === LEGACY_DOC_DIRECTOR_NAME) {
        batch.update(doc(db, 'members', docSnap.id), {
          name: CURRENT_DOC_DIRECTOR_NAME,
          updatedAt: serverTimestamp()
        });
        updatedCount += 1;
      }
    });

    const articlesSnap = await getDocs(collection(db, 'articles'));
    articlesSnap.docs.forEach((docSnap) => {
      const d = docSnap.data() as Record<string, unknown>;
      const rawApprovers = Array.isArray(d.designatedApprovers)
        ? (d.designatedApprovers as string[])
        : [];
      const rawHistory = Array.isArray(d.history) ? (d.history as RevisionSnapshot[]) : [];

      const hasLegacyApprover = rawApprovers.some((name) => name === LEGACY_DOC_DIRECTOR_NAME);
      const hasLegacyHistory = rawHistory.some(
        (rev) =>
          rev.author === LEGACY_DOC_DIRECTOR_NAME || rev.approver === LEGACY_DOC_DIRECTOR_NAME
      );

      if (hasLegacyApprover || hasLegacyHistory) {
        const updatePayload: Record<string, unknown> = {
          updatedAtServer: serverTimestamp()
        };
        if (hasLegacyApprover) {
          updatePayload.designatedApprovers = normalizeSupervisorList(rawApprovers).slice(0, 20);
        }
        if (hasLegacyHistory) {
          updatePayload.history = sanitizeHistoryList(normalizeRevisionHistoryNames(rawHistory));
        }
        batch.update(doc(db, 'articles', docSnap.id), updatePayload);
        updatedCount += 1;
      }
    });

    const reviewLogSnap = await getDocs(collection(db, 'reviewLog'));
    reviewLogSnap.docs.forEach((docSnap) => {
      const d = docSnap.data() as Record<string, unknown>;
      const hasLegacyReviewer = d.reviewedBy === LEGACY_DOC_DIRECTOR_NAME;
      const hasLegacyAuthor = d.author === LEGACY_DOC_DIRECTOR_NAME;
      if (hasLegacyReviewer || hasLegacyAuthor) {
        batch.update(doc(db, 'reviewLog', docSnap.id), {
          ...(hasLegacyReviewer ? { reviewedBy: CURRENT_DOC_DIRECTOR_NAME } : {}),
          ...(hasLegacyAuthor ? { author: CURRENT_DOC_DIRECTOR_NAME } : {}),
          updatedAt: serverTimestamp()
        });
        updatedCount += 1;
      }
    });

    if (updatedCount > 0) {
      await batch.commit();
    }
    return updatedCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'members');
  }
}

export function subscribePublicArticles(
  onData: (articles: Article[], isEmpty: boolean) => void
): () => void {
  const path = 'articles';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      if (snapshot.empty) {
        onData([], true);
        return;
      }
      const list: Article[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data() as Record<string, unknown>;
        const portal = (VALID_PORTALS.includes(d.portal as WikiPortal)
          ? d.portal
          : 'شخصيات وأعلام') as WikiPortal;
        const rawType = VALID_ARTICLE_TYPES.includes(d.articleType as ArticleType)
          ? (d.articleType as ArticleType)
          : undefined;
        const resolvedType = inferArticleType({
          articleType: rawType,
          portal,
          subtitle: String(d.subtitle ?? ''),
          birthDate: typeof d.birthDate === 'string' ? d.birthDate : '',
          deathDate: typeof d.deathDate === 'string' ? d.deathDate : '',
          birthDeath: String(d.birthDeath ?? ''),
          geographicLocation:
            typeof d.geographicLocation === 'string' ? d.geographicLocation : '',
          administrativeRegion:
            typeof d.administrativeRegion === 'string' ? d.administrativeRegion : '',
          coordinates: typeof d.coordinates === 'string' ? d.coordinates : ''
        });

        return {
          id: String(d.id ?? docSnap.id),
          name: String(d.name ?? ''),
          subtitle: String(d.subtitle ?? ''),
          portal,
          articleType: resolvedType,
          summary: String(d.summary ?? ''),
          field: String(d.field ?? ''),
          activeYears: String(d.activeYears ?? ''),
          birthDate: typeof d.birthDate === 'string' ? d.birthDate : '',
          deathDate: typeof d.deathDate === 'string' ? d.deathDate : '',
          birthDeath: String(d.birthDeath ?? ''),
          birthplace: String(d.birthplace ?? ''),
          clanAffiliation: typeof d.clanAffiliation === 'string' ? d.clanAffiliation : '',
          geographicLocation:
            typeof d.geographicLocation === 'string'
              ? d.geographicLocation
              : resolvedType === 'place'
                ? String(d.birthplace ?? '')
                : '',
          administrativeRegion:
            typeof d.administrativeRegion === 'string' ? d.administrativeRegion : '',
          coordinates: typeof d.coordinates === 'string' ? d.coordinates : '',
          populationEstimate:
            typeof d.populationEstimate === 'string' ? d.populationEstimate : '',
          relatedClans: typeof d.relatedClans === 'string' ? d.relatedClans : '',
          historicalEra:
            typeof d.historicalEra === 'string'
              ? d.historicalEra
              : resolvedType === 'general'
                ? String(d.birthDeath ?? '')
                : '',
          notableWorks: String(d.notableWorks ?? ''),
          infoboxRows: Array.isArray(d.infoboxRows)
            ? (d.infoboxRows as Article['infoboxRows'])
            : undefined,
          imageUrl: typeof d.imageUrl === 'string' ? d.imageUrl : '',
          imageCaption: typeof d.imageCaption === 'string' ? d.imageCaption : '',
          categories: Array.isArray(d.categories) ? (d.categories as string[]) : [],
          ...(Array.isArray(d.subcategories)
            ? { subcategories: d.subcategories as string[] }
            : {}),
          ...(typeof d.isStub === 'boolean' ? { isStub: d.isStub } : {}),
          ...(typeof d.needsSources === 'boolean' ? { needsSources: d.needsSources } : {}),
          ...(typeof d.isFeatured === 'boolean' ? { isFeatured: d.isFeatured } : {}),
          sections: Array.isArray(d.sections) ? (d.sections as Article['sections']) : [],
          references: Array.isArray(d.references)
            ? (d.references as Article['references'])
            : [],
          initials: String(d.initials ?? 'ف'),
          accentTone: (VALID_ACCENTS.includes(d.accentTone as AccentTone)
            ? d.accentTone
            : 'lapis') as AccentTone,
          updatedAt: String(d.updatedAt ?? ''),
          protectionLevel: (VALID_PROTECTIONS.includes(d.protectionLevel as ProtectionLevel)
            ? d.protectionLevel
            : 'semi-protected') as ProtectionLevel,
          designatedApprovers: Array.isArray(d.designatedApprovers)
            ? normalizeSupervisorList(d.designatedApprovers as string[])
            : [],
          talkMessages: [],
          history: Array.isArray(d.history)
            ? normalizeRevisionHistoryNames(d.history as RevisionSnapshot[])
            : []
        };
      });
      onData(list, false);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeGlobalSettings(onData: (settings: SystemSettings) => void): () => void {
  const path = 'settings/global';
  return onSnapshot(
    doc(db, 'settings', 'global'),
    (docSnap) => {
      if (!docSnap.exists()) {
        onData(DEFAULT_SYSTEM_SETTINGS);
        return;
      }
      const d = docSnap.data() as Record<string, unknown>;
      onData({
        siteName: String(d.siteName ?? DEFAULT_SYSTEM_SETTINGS.siteName),
        siteSubtitle: String(d.siteSubtitle ?? DEFAULT_SYSTEM_SETTINGS.siteSubtitle),
        requireMemberApproval:
          typeof d.requireMemberApproval === 'boolean'
            ? d.requireMemberApproval
            : DEFAULT_SYSTEM_SETTINGS.requireMemberApproval,
        allowImageUrls:
          typeof d.allowImageUrls === 'boolean'
            ? d.allowImageUrls
            : DEFAULT_SYSTEM_SETTINGS.allowImageUrls,
        defaultProtectionLevel: VALID_PROTECTIONS.includes(
          d.defaultProtectionLevel as ProtectionLevel
        )
          ? (d.defaultProtectionLevel as ProtectionLevel)
          : DEFAULT_SYSTEM_SETTINGS.defaultProtectionLevel,
        announcementBanner: String(d.announcementBanner ?? '')
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeArticleTalkMessages(
  articleId: string,
  onData: (messages: TalkMessage[]) => void
): () => void {
  const safeArticleId = sanitizeFirestoreId(articleId, 'entry');
  const path = `articles/${safeArticleId}/talkMessages`;
  const q = query(collection(db, 'articles', safeArticleId, 'talkMessages'), orderBy('createdAt', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const msgs: TalkMessage[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data() as Record<string, unknown>;
        return {
          id: docSnap.id,
          author: normalizeSupervisorName(String(d.author ?? 'باحث')),
          role: d.role === 'moderator' ? 'moderator' : 'visitor',
          topic: typeof d.topic === 'string' ? d.topic : '',
          text: String(d.text ?? ''),
          createdAt:
            typeof d.displayTimestamp === 'string' && d.displayTimestamp
              ? d.displayTimestamp
              : formatFirestoreTimestamp(d.createdAt)
        };
      });
      onData(msgs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribePendingRevisions(
  user: User | null,
  isAdmin: boolean,
  onData: (revisions: PendingRevision[]) => void
): () => void {
  if (!user || !user.emailVerified) {
    onData([]);
    return () => {};
  }

  const path = 'pendingRevisions';
  const q = isAdmin
    ? query(collection(db, path), where('status', '==', 'pending'))
    : query(collection(db, path), where('authorUid', '==', user.uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: PendingRevision[] = snapshot.docs
        .map((docSnap) => {
          const d = docSnap.data() as Record<string, unknown>;
          return {
            id: String(d.id ?? docSnap.id),
            type: d.type === 'new_article' ? 'new_article' : 'edit',
            articleId: String(d.articleId ?? ''),
            articleName: String(d.articleName ?? ''),
            author: normalizeSupervisorName(String(d.author ?? '')),
            summary: String(d.summary ?? ''),
            submittedAt: String(d.submittedAt ?? ''),
            status: (d.status ?? 'pending') as PendingRevision['status'],
            proposedData: d.proposedData as ArticleSnapshot,
            originalData: d.originalData as ArticleSnapshot | undefined,
            rejectionReason:
              typeof d.rejectionReason === 'string' ? d.rejectionReason : undefined,
            reviewedAt: typeof d.reviewedAt === 'string' ? d.reviewedAt : undefined,
            reviewedBy:
              typeof d.reviewedBy === 'string'
                ? normalizeSupervisorName(d.reviewedBy)
                : undefined,
            accentTone: d.accentTone as AccentTone | undefined,
            designatedApprovers: Array.isArray(d.designatedApprovers)
              ? normalizeSupervisorList(d.designatedApprovers as string[])
              : undefined,
            protectionLevel: d.protectionLevel as ProtectionLevel | undefined
          } satisfies PendingRevision;
        })
        .filter((r) => r.status === 'pending');

      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeAdminReviewLog(
  isAdmin: boolean,
  onData: (log: PendingRevision[]) => void
): () => void {
  if (!isAdmin) {
    onData([]);
    return () => {};
  }
  const path = 'reviewLog';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: PendingRevision[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data() as Record<string, unknown>;
        return {
          id: String(d.id ?? docSnap.id),
          type: d.type === 'new_article' ? 'new_article' : 'edit',
          articleId: String(d.articleId ?? ''),
          articleName: String(d.articleName ?? ''),
          author: normalizeSupervisorName(String(d.author ?? '')),
          summary: String(d.summary ?? ''),
          submittedAt: String(d.submittedAt ?? ''),
          status: (d.status ?? 'approved') as PendingRevision['status'],
          proposedData: d.proposedData as ArticleSnapshot,
          originalData: d.originalData as ArticleSnapshot | undefined,
          rejectionReason:
            typeof d.rejectionReason === 'string' ? d.rejectionReason : undefined,
          reviewedAt: typeof d.reviewedAt === 'string' ? d.reviewedAt : undefined,
          reviewedBy:
            typeof d.reviewedBy === 'string' ? normalizeSupervisorName(d.reviewedBy) : undefined
        };
      });
      items.sort((a, b) => (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? ''));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeAdminMembers(
  isAdmin: boolean,
  onData: (members: MemberAccount[]) => void
): () => void {
  if (!isAdmin) {
    onData(DEFAULT_MEMBERS);
    return () => {};
  }
  const path = 'members';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      if (snapshot.empty) {
        onData(DEFAULT_MEMBERS);
        return;
      }
      const list: MemberAccount[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data() as Record<string, unknown>;
        return {
          id: String(d.id ?? docSnap.id),
          name: normalizeSupervisorName(String(d.name ?? '')),
          roleTitle: String(d.roleTitle ?? ''),
          specialty: String(d.specialty ?? ''),
          status: d.status === 'suspended' ? 'suspended' : 'active',
          joinedAt: String(d.joinedAt ?? '')
        };
      });
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

function sanitizeDailyBuckets(raw: unknown): ArticleDailyBucket[] {
  if (!Array.isArray(raw)) return [];
  const map = new Map<string, ArticleDailyBucket>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const date = typeof rec.date === 'string' ? rec.date.slice(0, 10) : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const views =
      typeof rec.views === 'number' && Number.isFinite(rec.views)
        ? Math.max(0, Math.floor(rec.views))
        : 0;
    const interactions =
      typeof rec.interactions === 'number' && Number.isFinite(rec.interactions)
        ? Math.max(0, Math.floor(rec.interactions))
        : 0;
    const existing = map.get(date);
    if (existing) {
      existing.views += views;
      existing.interactions += interactions;
    } else {
      map.set(date, { date, views, interactions });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-35);
}

export function subscribeAdminArticleMetrics(
  isAdmin: boolean,
  onData: (metrics: Record<string, ArticleMetricRecord>) => void
): () => void {
  if (!isAdmin) {
    onData({});
    return () => {};
  }
  const path = 'articleMetrics';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const next: Record<string, ArticleMetricRecord> = {};
      snapshot.docs.forEach((docSnap) => {
        const d = docSnap.data() as Record<string, unknown>;
        const articleId = String(d.articleId ?? docSnap.id);
        next[articleId] = {
          articleId,
          totalViews:
            typeof d.totalViews === 'number' && Number.isFinite(d.totalViews)
              ? Math.max(0, Math.floor(d.totalViews))
              : 0,
          totalInteractions:
            typeof d.totalInteractions === 'number' && Number.isFinite(d.totalInteractions)
              ? Math.max(0, Math.floor(d.totalInteractions))
              : 0,
          dailyBuckets: sanitizeDailyBuckets(d.dailyBuckets),
          lastVisitedAt: typeof d.lastVisitedAt === 'string' ? d.lastVisitedAt : ''
        };
      });
      onData(next);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function recordArticleMetricInFirestore(
  articleId: string,
  kind: 'view' | 'interaction',
  dateKey: string,
  timestamp: string
): Promise<void> {
  const safeId = sanitizeFirestoreId(articleId, 'entry');
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
    ? dateKey
    : new Date().toISOString().slice(0, 10);
  const ref = doc(db, 'articleMetrics', safeId);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        articleId: safeId,
        totalViews: kind === 'view' ? 1 : 0,
        totalInteractions: kind === 'interaction' ? 1 : 0,
        dailyBuckets: [
          {
            date: safeDate,
            views: kind === 'view' ? 1 : 0,
            interactions: kind === 'interaction' ? 1 : 0
          }
        ],
        lastVisitedAt: clampStr(timestamp, 32),
        updatedAt: serverTimestamp()
      });
      return;
    }

    const existing = snap.data() as Record<string, unknown>;
    const currentViews =
      typeof existing.totalViews === 'number' && Number.isFinite(existing.totalViews)
        ? Math.max(0, Math.floor(existing.totalViews))
        : 0;
    const currentInteractions =
      typeof existing.totalInteractions === 'number' &&
      Number.isFinite(existing.totalInteractions)
        ? Math.max(0, Math.floor(existing.totalInteractions))
        : 0;

    const buckets = sanitizeDailyBuckets(existing.dailyBuckets);
    const existingBucket = buckets.find((b) => b.date === safeDate);
    if (existingBucket) {
      if (kind === 'view') existingBucket.views += 1;
      else existingBucket.interactions += 1;
    } else {
      buckets.push({
        date: safeDate,
        views: kind === 'view' ? 1 : 0,
        interactions: kind === 'interaction' ? 1 : 0
      });
    }

    const boundedBuckets = buckets
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-35);

    await updateDoc(ref, {
      totalViews: Math.min(10000000, currentViews + (kind === 'view' ? 1 : 0)),
      totalInteractions: Math.min(
        10000000,
        currentInteractions + (kind === 'interaction' ? 1 : 0)
      ),
      dailyBuckets: boundedBuckets,
      lastVisitedAt: clampStr(timestamp, 32),
      updatedAt: serverTimestamp()
    });
  } catch {
    // تجاهل أخطاء تسجيل الإحصاء بصمت حتى لا يتأثر تصفح القارئ
  }
}

/* ---------------- Firestore Mutation Operations ---------------- */

export async function createPendingRevisionInFirestore(
  revision: PendingRevision,
  authorUid: string
): Promise<void> {
  const revId = sanitizeFirestoreId(revision.id, 'pend');
  const path = `pendingRevisions/${revId}`;
  try {
    const payload: Record<string, unknown> = {
      id: revId,
      type: revision.type,
      articleId: sanitizeFirestoreId(revision.articleId, 'entry'),
      articleName: clampMinMax(revision.articleName, 2, 200, 'مقالة موسوعية'),
      author: clampMinMax(revision.author, 1, 120, 'باحث مساهم'),
      authorUid,
      summary: clampMinMax(revision.summary, 2, 500, 'مساهمة توثيقية'),
      submittedAt: clampStr(revision.submittedAt, 32),
      status: 'pending',
      proposedData: sanitizeArticleSnapshot(revision.proposedData),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (revision.originalData) {
      payload.originalData = sanitizeArticleSnapshot(revision.originalData);
    }
    if (revision.accentTone && VALID_ACCENTS.includes(revision.accentTone)) {
      payload.accentTone = revision.accentTone;
    }
    if (Array.isArray(revision.designatedApprovers)) {
      payload.designatedApprovers = revision.designatedApprovers
        .map((a) => clampStr(a, 120))
        .filter(Boolean)
        .slice(0, 20);
    }
    if (revision.protectionLevel && VALID_PROTECTIONS.includes(revision.protectionLevel)) {
      payload.protectionLevel = revision.protectionLevel;
    }

    await setDoc(doc(db, 'pendingRevisions', revId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createArticleInFirestore(article: Article): Promise<void> {
  const id = sanitizeFirestoreId(article.id, 'entry');
  const path = `articles/${id}`;
  try {
    await setDoc(doc(db, 'articles', id), buildArticleCreateDoc({ ...article, id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function publishArticleEditInFirestore(
  articleId: string,
  proposedData: ArticleSnapshot,
  newHistory: RevisionSnapshot[],
  updatedAtDate: string
): Promise<void> {
  const id = sanitizeFirestoreId(articleId, 'entry');
  const path = `articles/${id}`;
  const cleanSnap = sanitizeArticleSnapshot(proposedData);
  try {
    await updateDoc(doc(db, 'articles', id), {
      ...cleanSnap,
      initials: clampStr(computeInitials(cleanSnap.name), 16) || 'ف',
      updatedAt: clampStr(updatedAtDate, 32),
      history: sanitizeHistoryList(newHistory),
      updatedAtServer: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateArticleControlsInFirestore(
  articleId: string,
  payload: {
    portal: WikiPortal;
    protectionLevel: ProtectionLevel;
    designatedApprovers: string[];
    imageUrl: string;
    imageCaption: string;
    categories: string[];
    subcategories?: string[];
    isStub?: boolean;
    updatedAt: string;
  }
): Promise<void> {
  const id = sanitizeFirestoreId(articleId, 'entry');
  const path = `articles/${id}`;
  try {
    await updateDoc(doc(db, 'articles', id), {
      portal: VALID_PORTALS.includes(payload.portal) ? payload.portal : 'شخصيات وأعلام',
      protectionLevel: VALID_PROTECTIONS.includes(payload.protectionLevel)
        ? payload.protectionLevel
        : 'semi-protected',
      designatedApprovers: payload.designatedApprovers
        .map((a) => clampStr(a, 120))
        .filter(Boolean)
        .slice(0, 20),
      imageUrl: (() => {
        const safe = sanitizeImageUrl(payload.imageUrl);
        return safe.length <= MAX_IMAGE_URL_LENGTH ? safe : '';
      })(),
      imageCaption: clampStr(payload.imageCaption, 300),
      categories: payload.categories
        .map((c) => clampStr(c, 100))
        .filter(Boolean)
        .slice(0, 20),
      ...(Array.isArray(payload.subcategories)
        ? {
            subcategories: Array.from(
              new Set(
                payload.subcategories
                  .map((s) => clampStr(s, 100))
                  .filter(Boolean)
              )
            ).slice(0, 20)
          }
        : {}),
      ...(typeof payload.isStub === 'boolean' ? { isStub: payload.isStub } : {}),
      updatedAt: clampStr(payload.updatedAt, 32),
      updatedAtServer: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateArticleStubStatusInFirestore(
  articleId: string,
  isStub: boolean,
  updatedAt: string
): Promise<void> {
  const id = sanitizeFirestoreId(articleId, 'entry');
  const path = `articles/${id}`;
  try {
    await updateDoc(doc(db, 'articles', id), {
      isStub: Boolean(isStub),
      updatedAt: clampStr(updatedAt, 32),
      updatedAtServer: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateArticleQuickTagsInFirestore(
  articleId: string,
  patch: {
    isStub?: boolean;
    needsSources?: boolean;
    isFeatured?: boolean;
  },
  updatedAt: string
): Promise<void> {
  const id = sanitizeFirestoreId(articleId, 'entry');
  const path = `articles/${id}`;
  const updatePayload: Record<string, unknown> = {
    updatedAt: clampStr(updatedAt, 32),
    updatedAtServer: serverTimestamp()
  };

  if (typeof patch.isStub === 'boolean') {
    updatePayload.isStub = patch.isStub;
  }
  if (typeof patch.needsSources === 'boolean') {
    updatePayload.needsSources = patch.needsSources;
  }
  if (typeof patch.isFeatured === 'boolean') {
    updatePayload.isFeatured = patch.isFeatured;
  }

  try {
    await updateDoc(doc(db, 'articles', id), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteArticleInFirestore(articleId: string): Promise<void> {
  const id = sanitizeFirestoreId(articleId, 'entry');
  const path = `articles/${id}`;
  try {
    await deleteDoc(doc(db, 'articles', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function approveRevisionInFirestore(params: {
  revision: PendingRevision;
  existingArticle?: Article;
  approverName: string;
  timestamp: string;
  revEntryId: string;
}): Promise<void> {
  const { revision, existingArticle, approverName, timestamp, revEntryId } = params;
  const revId = sanitizeFirestoreId(revision.id, 'pend');
  const articleId = sanitizeFirestoreId(revision.articleId, 'entry');
  const todayDate = timestamp.slice(0, 10);
  const path = `pendingRevisions/${revId}`;

  try {
    const revDocSnap = await getDoc(doc(db, 'pendingRevisions', revId));
    const authorUid =
      (revDocSnap.exists() ? (revDocSnap.data().authorUid as string) : undefined) ??
      'system';

    const batch = writeBatch(db);
    const cleanProposed = sanitizeArticleSnapshot(revision.proposedData);

    if (revision.type === 'new_article' || !existingArticle) {
      const createdArticle: Article = {
        ...cleanProposed,
        id: articleId,
        initials: computeInitials(cleanProposed.name),
        accentTone: revision.accentTone ?? 'lapis',
        updatedAt: todayDate,
        protectionLevel: revision.protectionLevel ?? 'semi-protected',
        designatedApprovers: revision.designatedApprovers ?? [approverName],
        talkMessages: [],
        history: [
          {
            id: revEntryId,
            timestamp,
            author: revision.author,
            approver: approverName,
            summary: revision.summary,
            status: 'approved',
            snapshot: cleanProposed
          }
        ]
      };
      batch.set(doc(db, 'articles', articleId), buildArticleCreateDoc(createdArticle));
    } else {
      const nextHistory: RevisionSnapshot[] = [
        ...existingArticle.history,
        {
          id: revEntryId,
          timestamp,
          author: revision.author,
          approver: approverName,
          summary: revision.summary,
          status: 'approved',
          snapshot: cleanProposed
        }
      ];
      batch.update(doc(db, 'articles', articleId), {
        ...cleanProposed,
        initials: clampStr(computeInitials(cleanProposed.name), 16) || 'ف',
        updatedAt: todayDate,
        history: sanitizeHistoryList(nextHistory),
        updatedAtServer: serverTimestamp()
      });
    }

    batch.update(doc(db, 'pendingRevisions', revId), {
      status: 'approved',
      reviewedAt: clampStr(timestamp, 32),
      reviewedBy: clampStr(approverName, 120),
      updatedAt: serverTimestamp()
    });

    const logPayload: Record<string, unknown> = {
      id: revId,
      type: revision.type,
      articleId,
      articleName: clampStr(revision.articleName, 200),
      author: clampStr(revision.author, 120),
      authorUid,
      summary: clampStr(revision.summary, 500),
      submittedAt: clampStr(revision.submittedAt, 32),
      status: 'approved',
      proposedData: cleanProposed,
      reviewedAt: clampStr(timestamp, 32),
      reviewedBy: clampStr(approverName, 120),
      createdAt: revDocSnap.exists() ? revDocSnap.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (revision.originalData) {
      logPayload.originalData = sanitizeArticleSnapshot(revision.originalData);
    }

    batch.set(doc(db, 'reviewLog', revId), logPayload);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function rejectRevisionInFirestore(params: {
  revision: PendingRevision;
  reason: string;
  reviewedBy: string;
  timestamp: string;
}): Promise<void> {
  const { revision, reason, reviewedBy, timestamp } = params;
  const revId = sanitizeFirestoreId(revision.id, 'pend');
  const path = `pendingRevisions/${revId}`;

  try {
    const revDocSnap = await getDoc(doc(db, 'pendingRevisions', revId));
    const authorUid =
      (revDocSnap.exists() ? (revDocSnap.data().authorUid as string) : undefined) ??
      'system';

    const batch = writeBatch(db);
    batch.update(doc(db, 'pendingRevisions', revId), {
      status: 'rejected',
      rejectionReason: clampStr(reason, 500),
      reviewedAt: clampStr(timestamp, 32),
      reviewedBy: clampStr(reviewedBy, 120),
      updatedAt: serverTimestamp()
    });

    const logPayload: Record<string, unknown> = {
      id: revId,
      type: revision.type,
      articleId: sanitizeFirestoreId(revision.articleId, 'entry'),
      articleName: clampStr(revision.articleName, 200),
      author: clampStr(revision.author, 120),
      authorUid,
      summary: clampStr(revision.summary, 500),
      submittedAt: clampStr(revision.submittedAt, 32),
      status: 'rejected',
      proposedData: sanitizeArticleSnapshot(revision.proposedData),
      rejectionReason: clampStr(reason, 500),
      reviewedAt: clampStr(timestamp, 32),
      reviewedBy: clampStr(reviewedBy, 120),
      createdAt: revDocSnap.exists() ? revDocSnap.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (revision.originalData) {
      logPayload.originalData = sanitizeArticleSnapshot(revision.originalData);
    }

    batch.set(doc(db, 'reviewLog', revId), logPayload);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function addTalkMessageInFirestore(params: {
  articleId: string;
  author: string;
  authorUid: string;
  role: 'visitor' | 'moderator';
  topic: string;
  text: string;
  displayTimestamp: string;
}): Promise<void> {
  const articleId = sanitizeFirestoreId(params.articleId, 'entry');
  const msgId = `talk-${Date.now()}`;
  const path = `articles/${articleId}/talkMessages/${msgId}`;
  try {
    await setDoc(doc(db, 'articles', articleId, 'talkMessages', msgId), {
      author: clampMinMax(params.author, 1, 120, 'باحث زائر'),
      authorUid: params.authorUid,
      role: params.role,
      topic: clampStr(params.topic, 200),
      text: clampMinMax(params.text, 2, 4000, 'ملاحظة'),
      displayTimestamp: clampStr(params.displayTimestamp, 32),
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function addMemberInFirestore(member: MemberAccount): Promise<void> {
  const memId = sanitizeFirestoreId(member.id, 'mem');
  const path = `members/${memId}`;
  try {
    await setDoc(doc(db, 'members', memId), {
      id: memId,
      name: clampStr(member.name, 120),
      roleTitle: clampStr(member.roleTitle, 100),
      specialty: clampStr(member.specialty, 160),
      status: member.status === 'suspended' ? 'suspended' : 'active',
      joinedAt: clampStr(member.joinedAt, 32),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleMemberStatusInFirestore(
  memberId: string,
  nextStatus: 'active' | 'suspended'
): Promise<void> {
  const memId = sanitizeFirestoreId(memberId, 'mem');
  const path = `members/${memId}`;
  try {
    await updateDoc(doc(db, 'members', memId), {
      status: nextStatus,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeMemberInFirestore(memberId: string): Promise<void> {
  const memId = sanitizeFirestoreId(memberId, 'mem');
  const path = `members/${memId}`;
  try {
    await deleteDoc(doc(db, 'members', memId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSystemSettingsInFirestore(settings: SystemSettings): Promise<void> {
  const path = 'settings/global';
  try {
    await setDoc(doc(db, 'settings', 'global'), {
      siteName: clampStr(settings.siteName, 120, 'ويكي فيلي') || 'ويكي فيلي',
      siteSubtitle: clampStr(settings.siteSubtitle, 300),
      requireMemberApproval: Boolean(settings.requireMemberApproval),
      allowImageUrls: Boolean(settings.allowImageUrls),
      defaultProtectionLevel: VALID_PROTECTIONS.includes(settings.defaultProtectionLevel)
        ? settings.defaultProtectionLevel
        : 'semi-protected',
      announcementBanner: clampStr(settings.announcementBanner, 600),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncStateToFirestore(
  nextState: EncyclopediaState,
  adminUid: string
): Promise<void> {
  const path = 'articles';
  try {
    const [existingArtSnaps, existingMemSnaps, existingPendSnaps] = await Promise.all([
      getDocs(collection(db, 'articles')),
      getDocs(collection(db, 'members')),
      getDocs(collection(db, 'pendingRevisions'))
    ]);

    const existingArtCreated = new Map<string, unknown>();
    existingArtSnaps.forEach((d) => existingArtCreated.set(d.id, d.data().createdAt));

    const existingMemCreated = new Map<string, unknown>();
    existingMemSnaps.forEach((d) => existingMemCreated.set(d.id, d.data().createdAt));

    const existingPendCreated = new Map<string, unknown>();
    existingPendSnaps.forEach((d) => existingPendCreated.set(d.id, d.data().createdAt));

    const batch = writeBatch(db);

    for (const art of nextState.articles) {
      const id = sanitizeFirestoreId(art.id, 'entry');
      const docPayload = buildArticleCreateDoc({ ...art, id });
      const prevCreated = existingArtCreated.get(id);
      if (prevCreated) {
        docPayload.createdAt = prevCreated as typeof docPayload.createdAt;
      }
      batch.set(doc(db, 'articles', id), docPayload);
    }

    for (const mem of nextState.members) {
      const memId = sanitizeFirestoreId(mem.id, 'mem');
      batch.set(doc(db, 'members', memId), {
        id: memId,
        name: clampStr(mem.name, 120),
        roleTitle: clampStr(mem.roleTitle, 100),
        specialty: clampStr(mem.specialty, 160),
        status: mem.status === 'suspended' ? 'suspended' : 'active',
        joinedAt: clampStr(mem.joinedAt, 32),
        createdAt: existingMemCreated.get(memId) ?? serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    for (const rev of nextState.pendingRevisions) {
      const revId = sanitizeFirestoreId(rev.id, 'pend');
      batch.set(doc(db, 'pendingRevisions', revId), {
        id: revId,
        type: rev.type,
        articleId: sanitizeFirestoreId(rev.articleId, 'entry'),
        articleName: clampStr(rev.articleName, 200),
        author: clampStr(rev.author, 120),
        authorUid: adminUid,
        summary: clampStr(rev.summary, 500),
        submittedAt: clampStr(rev.submittedAt, 32),
        status: 'pending',
        proposedData: sanitizeArticleSnapshot(rev.proposedData),
        ...(rev.originalData ? { originalData: sanitizeArticleSnapshot(rev.originalData) } : {}),
        createdAt: existingPendCreated.get(revId) ?? serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    batch.set(doc(db, 'settings', 'global'), {
      siteName: clampStr(nextState.settings.siteName, 120),
      siteSubtitle: clampStr(nextState.settings.siteSubtitle, 300),
      requireMemberApproval: Boolean(nextState.settings.requireMemberApproval),
      allowImageUrls: Boolean(nextState.settings.allowImageUrls),
      defaultProtectionLevel: nextState.settings.defaultProtectionLevel,
      announcementBanner: clampStr(nextState.settings.announcementBanner, 600),
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
