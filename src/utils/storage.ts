import {
  DEFAULT_ACTIVE_MEMBER,
  DEFAULT_MEMBERS,
  DEFAULT_SYSTEM_SETTINGS,
  DEFAULT_USER_ROLE,
  INITIAL_ARTICLES,
  INITIAL_PENDING_REVISIONS
} from '../data/initialEncyclopedia';
import {
  Article,
  EncyclopediaState,
  MemberAccount,
  PendingRevision,
  ProtectionLevel,
  SystemSettings,
  UserRole,
  WikiPortal,
  inferArticleType
} from '../types/encyclopedia';

const STORAGE_KEY_V7 = 'wiki_feyli_state_v7';
const STORAGE_KEY_V6 = 'wiki_feyli_state_v6';
const STORAGE_KEY_V5 = 'wiki_feyli_state_v5';
const STORAGE_KEY_V4 = 'wiki_feyli_state_v4';
const STORAGE_KEY_V3 = 'wiki_feyli_state_v3';
const STORAGE_KEY_V2 = 'feyli_encyclopedia_state_v2';
const STORAGE_KEY_V1 = 'feyli_encyclopedia_state_v1';
const CURRENT_VERSION = 7;

export function getDefaultState(): EncyclopediaState {
  return {
    version: CURRENT_VERSION,
    articles: INITIAL_ARTICLES,
    pendingRevisions: INITIAL_PENDING_REVISIONS,
    reviewLog: [],
    members: DEFAULT_MEMBERS,
    activeMemberName: DEFAULT_ACTIVE_MEMBER,
    userRole: DEFAULT_USER_ROLE,
    settings: DEFAULT_SYSTEM_SETTINGS
  };
}

function isValidRole(role: unknown): role is UserRole {
  return role === 'visitor' || role === 'moderator';
}

function isValidProtection(level: unknown): level is ProtectionLevel {
  return level === 'semi-protected' || level === 'strict-review' || level === 'open';
}

function inferPortal(art: Partial<Article>): WikiPortal {
  const validPortals: WikiPortal[] = [
    'شخصيات وأعلام',
    'عشائر وأنساب',
    'فنون وثقافة',
    'أماكن ومدن',
    'أحداث تاريخية',
    'إعلام وسياسة'
  ];
  if (art.portal && validPortals.includes(art.portal)) {
    return art.portal;
  }
  const f = (art.field ?? '').toLowerCase();
  if (f.includes('عشائر') || f.includes('أنساب')) return 'عشائر وأنساب';
  if (f.includes('فنون') || f.includes('ثقافة') || f.includes('لغة') || f.includes('موسيقى'))
    return 'فنون وثقافة';
  if (f.includes('أماكن') || f.includes('مدن') || f.includes('جغرافيا')) return 'أماكن ومدن';
  if (f.includes('أحداث')) return 'أحداث تاريخية';
  if (f.includes('صحافة') || f.includes('إعلام') || f.includes('سياسة')) return 'إعلام وسياسة';
  return 'شخصيات وأعلام';
}

export const MAX_IMAGE_URL_LENGTH = 2048;

export interface ImageUrlValidationResult {
  valid: boolean;
  sanitized: string;
  error?: string;
  transformedNote?: string;
}

export interface ImageLoadCandidate {
  src: string;
  referrerPolicy: 'no-referrer' | 'strict-origin-when-cross-origin';
}

function extractGoogleDriveFileId(parsed: URL): string | null {
  const host = parsed.hostname.toLowerCase();
  if (host !== 'drive.google.com' && host !== 'docs.google.com') return null;

  const fileMatch = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (fileMatch?.[1]) return fileMatch[1];

  const idParam = parsed.searchParams.get('id');
  if (idParam && /^[a-zA-Z0-9_-]{10,}$/.test(idParam)) {
    return idParam;
  }

  return null;
}

function extractWikimediaFileName(parsed: URL): string | null {
  const host = parsed.hostname.toLowerCase();
  const isWikiHost =
    host === 'commons.wikimedia.org' ||
    host.endsWith('.wikipedia.org') ||
    host.endsWith('.wikimedia.org');
  if (!isWikiHost || host === 'upload.wikimedia.org') return null;

  // Handle #/media/File:... or #/media/ملف:...
  if (parsed.hash) {
    let decodedHash = parsed.hash;
    try {
      decodedHash = decodeURIComponent(parsed.hash);
    } catch {
      // keep raw hash
    }
    const mediaMatch = decodedHash.match(/#\/media\/(?:File|Image|ملف|صورة):(.+)$/i);
    if (mediaMatch?.[1]) {
      return mediaMatch[1].trim();
    }
  }

  // Handle /wiki/File:... or /wiki/ملف:...
  let decodedPath = parsed.pathname;
  try {
    decodedPath = decodeURIComponent(parsed.pathname);
  } catch {
    // keep raw path
  }
  const wikiFileMatch = decodedPath.match(/\/wiki\/(?:File|Image|ملف|صورة):(.+)$/i);
  if (wikiFileMatch?.[1]) {
    return wikiFileMatch[1].trim();
  }

  return null;
}

export function validateImageUrl(rawUrl: string | undefined): ImageUrlValidationResult {
  if (!rawUrl) {
    return { valid: true, sanitized: '' };
  }

  let candidate = rawUrl.trim().replace(/^["'<\s]+|["'>\s]+$/g, '');
  if (!candidate) {
    return { valid: true, sanitized: '' };
  }

  if (/^data:image\//i.test(candidate)) {
    return {
      valid: false,
      sanitized: '',
      error:
        'لا يمكن حفظ صورة مضمنة بصيغة Base64 مباشرة؛ يرجى نسخ رابط الصورة المباشر (يبدأ بـ https://).'
    };
  }

  if (candidate.startsWith('/') && !candidate.startsWith('//')) {
    if (candidate.length > MAX_IMAGE_URL_LENGTH) {
      return {
        valid: false,
        sanitized: '',
        error: `رابط الصورة طويل جداً (الحد الأقصى ${MAX_IMAGE_URL_LENGTH} حرفاً).`
      };
    }
    return { valid: true, sanitized: candidate };
  }

  // Protocol-relative URL: //upload.wikimedia.org/...
  if (candidate.startsWith('//')) {
    candidate = `https:${candidate}`;
  } else if (
    !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate) &&
    /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(?:[:/?#]|$)/.test(candidate)
  ) {
    // Bare domain without scheme: upload.wikimedia.org/... or example.com/img.jpg
    candidate = `https://${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return {
      valid: false,
      sanitized: '',
      error: 'تنسيق رابط الصورة غير صحيح. تأكد من إدخال رابط URL كامل يبدأ بـ https:// أو http://.'
    };
  }

  if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || !parsed.hostname) {
    return {
      valid: false,
      sanitized: '',
      error: 'رابط الصورة غير صالح. يجب أن يبدأ بـ https:// أو http://.'
    };
  }

  const host = parsed.hostname.toLowerCase();

  // 1. Google Images redirect link: https://www.google.com/imgres?imgurl=...
  if (host.includes('google.') && parsed.pathname.includes('/imgres')) {
    const imgUrlParam = parsed.searchParams.get('imgurl');
    if (imgUrlParam) {
      const unwrapped = validateImageUrl(imgUrlParam);
      if (unwrapped.valid && unwrapped.sanitized) {
        return {
          ...unwrapped,
          transformedNote:
            unwrapped.transformedNote ??
            'تم استخراج رابط الصورة المباشر من رابط بحث صور Google تلقائياً.'
        };
      }
    }
  }

  // 2. Google Drive share link -> direct thumbnail/image endpoint
  const driveId = extractGoogleDriveFileId(parsed);
  if (driveId) {
    const normalizedDrive = `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`;
    return {
      valid: true,
      sanitized: normalizedDrive,
      transformedNote:
        'تم تحويل رابط Google Drive تلقائياً إلى رابط صورة مباشر (تأكد أن صلاحية الملف: أي شخص لديه الرابط).'
    };
  }

  // 3. Dropbox share link -> direct raw image endpoint
  if (host === 'dropbox.com' || host.endsWith('.dropbox.com')) {
    const dropboxUrl = new URL(parsed.toString());
    const hadRaw = dropboxUrl.searchParams.get('raw') === '1';
    dropboxUrl.searchParams.delete('dl');
    dropboxUrl.searchParams.set('raw', '1');
    const normalizedDropbox = dropboxUrl.toString();
    if (normalizedDropbox.length > MAX_IMAGE_URL_LENGTH) {
      return {
        valid: false,
        sanitized: '',
        error: `رابط الصورة طويل جداً (الحد الأقصى ${MAX_IMAGE_URL_LENGTH} حرفاً).`
      };
    }
    return {
      valid: true,
      sanitized: normalizedDropbox,
      ...(hadRaw
        ? {}
        : { transformedNote: 'تم تحويل رابط Dropbox تلقائياً إلى رابط عرض مباشر.' })
    };
  }

  // 4. Wikimedia Commons / Wikipedia File: or ملف: page -> Special:FilePath direct image
  const wikiFileName = extractWikimediaFileName(parsed);
  if (wikiFileName) {
    const normalizedWiki = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
      wikiFileName
    )}?width=900`;
    return {
      valid: true,
      sanitized: normalizedWiki,
      transformedNote: 'تم تحويل رابط صفحة الملف في ويكيبيديا/ويكيميديا إلى رابط صورة مباشر تلقائياً.'
    };
  }

  // 5. Imgur single-image viewer page: https://imgur.com/<id> -> https://i.imgur.com/<id>.jpg
  if (host === 'imgur.com' || host === 'www.imgur.com' || host === 'm.imgur.com') {
    const imgurMatch = parsed.pathname.match(/^\/([a-zA-Z0-9]{5,12})\/?$/);
    if (imgurMatch?.[1]) {
      return {
        valid: true,
        sanitized: `https://i.imgur.com/${imgurMatch[1]}.jpg`,
        transformedNote: 'تم تحويل رابط Imgur تلقائياً إلى رابط صورة مباشر.'
      };
    }
  }

  const finalUrl = parsed.toString();
  if (finalUrl.length > MAX_IMAGE_URL_LENGTH) {
    return {
      valid: false,
      sanitized: '',
      error: `رابط الصورة طويل جداً (${finalUrl.length} حرفاً). الحد الأقصى المسموح هو ${MAX_IMAGE_URL_LENGTH} حرفاً.`
    };
  }

  return { valid: true, sanitized: finalUrl };
}

export function sanitizeImageUrl(rawUrl: string | undefined): string {
  return validateImageUrl(rawUrl).sanitized;
}

export function getImageLoadCandidates(rawUrl: string | undefined): ImageLoadCandidate[] {
  const cleanUrl = sanitizeImageUrl(rawUrl);
  if (!cleanUrl) return [];

  const candidates: ImageLoadCandidate[] = [];
  const seen = new Set<string>();
  const push = (src: string, referrerPolicy: 'no-referrer' | 'strict-origin-when-cross-origin') => {
    const key = `${referrerPolicy}::${src}`;
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push({ src, referrerPolicy });
    }
  };

  // Prefer HTTPS upgrade first if the link is http:// (avoids mixed-content blocking on HTTPS pages)
  if (cleanUrl.startsWith('http://')) {
    const upgraded = `https://${cleanUrl.slice('http://'.length)}`;
    push(upgraded, 'no-referrer');
    push(upgraded, 'strict-origin-when-cross-origin');
    push(cleanUrl, 'no-referrer');
    return candidates;
  }

  push(cleanUrl, 'no-referrer');

  // Google Drive fallbacks (lh3 CDN & uc?export=view)
  try {
    const parsed = new URL(cleanUrl);
    const driveId = extractGoogleDriveFileId(parsed);
    if (driveId) {
      push(`https://lh3.googleusercontent.com/d/${driveId}=w1200`, 'no-referrer');
      push(`https://drive.google.com/uc?export=view&id=${driveId}`, 'no-referrer');
    }

    // Imgur alternate extensions if auto-converted from viewer page
    if (parsed.hostname.toLowerCase() === 'i.imgur.com') {
      const m = parsed.pathname.match(/^\/([a-zA-Z0-9]{5,12})\.jpg$/i);
      if (m?.[1]) {
        push(`https://i.imgur.com/${m[1]}.png`, 'no-referrer');
        push(`https://i.imgur.com/${m[1]}.webp`, 'no-referrer');
      }
    }
  } catch {
    // relative URL; no host-specific fallbacks needed
  }

  // Fallback with standard referrer policy in case the CDN rejects empty Referer headers
  push(cleanUrl, 'strict-origin-when-cross-origin');

  return candidates;
}

function normalizeArticle(art: Article): Article {
  const portal = inferPortal(art);
  const articleType = inferArticleType({ ...art, portal });
  return {
    ...art,
    portal,
    articleType,
    ...(Array.isArray(art.subcategories)
      ? {
          subcategories: Array.from(
            new Set(
              art.subcategories
                .filter((s): s is string => typeof s === 'string')
                .map((s) => s.trim())
                .filter(Boolean)
            )
          ).slice(0, 20)
        }
      : {}),
    imageUrl: sanitizeImageUrl(art.imageUrl),
    imageCaption: art.imageCaption ?? '',
    protectionLevel: isValidProtection(art.protectionLevel)
      ? art.protectionLevel
      : 'semi-protected',
    designatedApprovers:
      Array.isArray(art.designatedApprovers) && art.designatedApprovers.length > 0
        ? art.designatedApprovers
        : [DEFAULT_ACTIVE_MEMBER]
  };
}

function normalizeMember(mem: Partial<MemberAccount>, idx: number): MemberAccount {
  return {
    id: mem.id ?? `mem-${idx + 1}`,
    name: mem.name ?? `عضو مشرف ${idx + 1}`,
    roleTitle: mem.roleTitle ?? (idx === 0 ? 'مدير النظام' : 'مشرف مراجعة'),
    specialty: mem.specialty ?? 'التوثيق العام',
    status: mem.status === 'suspended' ? 'suspended' : 'active',
    joinedAt: mem.joinedAt ?? '2026-09-01'
  };
}

function normalizeSettings(raw: Partial<SystemSettings> | undefined): SystemSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SYSTEM_SETTINGS;
  return {
    siteName: raw.siteName?.trim() || DEFAULT_SYSTEM_SETTINGS.siteName,
    siteSubtitle: raw.siteSubtitle?.trim() || DEFAULT_SYSTEM_SETTINGS.siteSubtitle,
    requireMemberApproval:
      typeof raw.requireMemberApproval === 'boolean'
        ? raw.requireMemberApproval
        : DEFAULT_SYSTEM_SETTINGS.requireMemberApproval,
    allowImageUrls:
      typeof raw.allowImageUrls === 'boolean'
        ? raw.allowImageUrls
        : DEFAULT_SYSTEM_SETTINGS.allowImageUrls,
    defaultProtectionLevel: isValidProtection(raw.defaultProtectionLevel)
      ? raw.defaultProtectionLevel
      : DEFAULT_SYSTEM_SETTINGS.defaultProtectionLevel,
    announcementBanner: raw.announcementBanner ?? ''
  };
}

function isValidArticleArray(arr: unknown): arr is Article[] {
  return (
    Array.isArray(arr) &&
    arr.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as Article).id === 'string' &&
        typeof (item as Article).name === 'string' &&
        typeof (item as Article).summary === 'string' &&
        Array.isArray((item as Article).sections) &&
        Array.isArray((item as Article).references)
    )
  );
}

function isValidRevisionArray(arr: unknown): arr is PendingRevision[] {
  return (
    Array.isArray(arr) &&
    arr.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as PendingRevision).id === 'string' &&
        typeof (item as PendingRevision).articleName === 'string' &&
        (item as PendingRevision).proposedData &&
        typeof (item as PendingRevision).proposedData === 'object'
    )
  );
}

function isValidMemberArray(arr: unknown): arr is MemberAccount[] {
  return (
    Array.isArray(arr) &&
    arr.length > 0 &&
    arr.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as MemberAccount).id === 'string' &&
        typeof (item as MemberAccount).name === 'string'
    )
  );
}

export function loadEncyclopediaState(): EncyclopediaState {
  try {
    const rawV7 = window.localStorage.getItem(STORAGE_KEY_V7);
    const rawV6 = window.localStorage.getItem(STORAGE_KEY_V6);
    const rawV5 = window.localStorage.getItem(STORAGE_KEY_V5);
    const rawV4 = window.localStorage.getItem(STORAGE_KEY_V4);
    const rawV3 = window.localStorage.getItem(STORAGE_KEY_V3);
    const rawV2 = window.localStorage.getItem(STORAGE_KEY_V2);
    const rawV1 = window.localStorage.getItem(STORAGE_KEY_V1);
    const raw = rawV7 ?? rawV6 ?? rawV5 ?? rawV4 ?? rawV3 ?? rawV2 ?? rawV1;
    if (!raw) {
      return getDefaultState();
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return getDefaultState();
    }
    const obj = parsed as Partial<EncyclopediaState>;
    if (!isValidArticleArray(obj.articles) || obj.articles.length === 0) {
      return getDefaultState();
    }

    let migratedArticles = obj.articles.map((art) => normalizeArticle(art));

    // When migrating from v1-v6, append missing seed articles and upgrade unedited
    // feyli-tribes-clans seed to the latest entry while preserving user edits.
    if (!rawV7) {
      const tribesSeed = INITIAL_ARTICLES.find((a) => a.id === 'feyli-tribes-clans');
      if (tribesSeed) {
        migratedArticles = migratedArticles.map((art) => {
          const isUneditedTribesSeed =
            art.id === 'feyli-tribes-clans' &&
            art.history.length <= 1 &&
            art.history[0]?.id === 'rev-701';
          if (isUneditedTribesSeed) {
            return {
              ...tribesSeed,
              talkMessages: art.talkMessages,
              imageUrl: art.imageUrl || tribesSeed.imageUrl
            };
          }
          return art;
        });
      }

      const existingIds = new Set(migratedArticles.map((a) => a.id));
      for (const seed of INITIAL_ARTICLES) {
        if (!existingIds.has(seed.id)) {
          migratedArticles.push(seed);
        }
      }
    }

    const members = isValidMemberArray(obj.members)
      ? obj.members.map((m, idx) => normalizeMember(m, idx))
      : DEFAULT_MEMBERS;

    const activeMemberName =
      typeof obj.activeMemberName === 'string' && obj.activeMemberName.trim()
        ? obj.activeMemberName
        : members[0].name;

    return {
      version: CURRENT_VERSION,
      articles: migratedArticles,
      pendingRevisions: isValidRevisionArray(obj.pendingRevisions) ? obj.pendingRevisions : [],
      reviewLog: isValidRevisionArray(obj.reviewLog) ? obj.reviewLog : [],
      members,
      activeMemberName,
      userRole: isValidRole(obj.userRole) ? obj.userRole : DEFAULT_USER_ROLE,
      settings: normalizeSettings(obj.settings)
    };
  } catch {
    return getDefaultState();
  }
}

export function saveEncyclopediaState(state: EncyclopediaState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_V7, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function exportEncyclopediaJson(state: EncyclopediaState): void {
  const payload = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      platform: state.settings.siteName || 'ويكي فيلي',
      ...state
    },
    null,
    2
  );
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `wiki-feyli-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function validateAndParseImportJson(rawText: string): EncyclopediaState | null {
  try {
    const parsed: unknown = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Partial<EncyclopediaState>;
    if (!isValidArticleArray(obj.articles) || obj.articles.length === 0) {
      return null;
    }
    const members = isValidMemberArray(obj.members)
      ? obj.members.map((m, idx) => normalizeMember(m, idx))
      : DEFAULT_MEMBERS;

    return {
      version: CURRENT_VERSION,
      articles: obj.articles.map((art) => normalizeArticle(art)),
      pendingRevisions: isValidRevisionArray(obj.pendingRevisions) ? obj.pendingRevisions : [],
      reviewLog: isValidRevisionArray(obj.reviewLog) ? obj.reviewLog : [],
      members,
      activeMemberName:
        typeof obj.activeMemberName === 'string' && obj.activeMemberName.trim()
          ? obj.activeMemberName
          : members[0].name,
      userRole: isValidRole(obj.userRole) ? obj.userRole : DEFAULT_USER_ROLE,
      settings: normalizeSettings(obj.settings)
    };
  } catch {
    return null;
  }
}

export function formatCurrentTimestamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

export function computeInitials(fullName: string): string {
  const cleaned = fullName
    .replace(/^(الدكتور|د\.|الأستاذ|أ\.|الشيخ|الحاج|الملا|عشيرة|مدينة|موسيقى|تاريخ)\s+/g, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ف';
  if (parts.length === 1) return parts[0].charAt(0);
  return `${parts[0].charAt(0)} ${parts[1].charAt(0)}`;
}
