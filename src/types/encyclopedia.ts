export type UserRole = 'visitor' | 'moderator';

export type AccentTone = 'lapis' | 'bronze' | 'forest' | 'terracotta';

export type ProtectionLevel = 'semi-protected' | 'strict-review' | 'open';

export type ArticleType = 'person' | 'place' | 'general';

export const ARTICLE_TYPE_OPTIONS: Array<{
  id: ArticleType;
  label: string;
  badgeLabel: string;
  description: string;
}> = [
  {
    id: 'person',
    label: 'شخصية',
    badgeLabel: 'شخصية وعلم',
    description: 'أعلام، شعراء، مؤرخون، أكاديميون، فنانون، أو شخصيات عامة'
  },
  {
    id: 'place',
    label: 'منطقة',
    badgeLabel: 'منطقة جغرافية',
    description: 'مدن، أقضية، قرى، محلات تاريخية، أو معالم جغرافية'
  },
  {
    id: 'general',
    label: 'موضوع عام / عشيرة / حدث',
    badgeLabel: 'موضوع موسوعي',
    description: 'عشائر وأنساب، فنون وتراث، أحداث تاريخية، أو مواضيع موسوعية أخرى'
  }
];

export type WikiPortal =
  | 'شخصيات وأعلام'
  | 'عشائر وأنساب'
  | 'فنون وثقافة'
  | 'أماكن ومدن'
  | 'أحداث تاريخية'
  | 'إعلام وسياسة';

export const WIKI_PORTALS: Array<{
  id: WikiPortal;
  slug: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: 'شخصيات وأعلام',
    slug: 'figures',
    shortLabel: 'الشخصيات والأعلام',
    description: 'سير المفكرين والأدباء والعلماء والرواد الفيليين'
  },
  {
    id: 'عشائر وأنساب',
    slug: 'tribes',
    shortLabel: 'العشائر والأنساب',
    description: 'تاريخ العشائر والقبائل الفيلية وامتداداتها الجغرافية'
  },
  {
    id: 'فنون وثقافة',
    slug: 'arts-culture',
    shortLabel: 'الفنون والثقافة',
    description: 'الموسيقى الفيلية، الهوره، المقام، الشعر، واللهجة'
  },
  {
    id: 'أماكن ومدن',
    slug: 'places',
    shortLabel: 'الأماكن والمدن',
    description: 'خانقين، مندلي، بدرة، إيلام، ومحلات بغداد التاريخية'
  },
  {
    id: 'أحداث تاريخية',
    slug: 'history',
    shortLabel: 'الأحداث التاريخية',
    description: 'المحطات التاريخية والتحولات الاجتماعية الموثقة'
  },
  {
    id: 'إعلام وسياسة',
    slug: 'media-politics',
    shortLabel: 'الإعلام والسياسة',
    description: 'الصحافة، النشر، المشاركة المدنية والسياسية'
  }
];

export const PORTAL_SUBCATEGORY_SUGGESTIONS: Record<WikiPortal, string[]> = {
  'شخصيات وأعلام': [
    'شعراء وأدباء',
    'أكاديميون وباحثون',
    'مفكرون ومؤرخون',
    'فنانون وموسيقيون',
    'شخصيات وطنية ومجتمعية',
    'تقنية وسياسات رقمية'
  ],
  'عشائر وأنساب': [
    'عشائر الكلهور',
    'عشائر الأركوازي',
    'عشائر ملك شاهي',
    'عشائر اللور والكردلية',
    'عشائر الزنكنة والباوية',
    'الأنساب ونظام التوشمال'
  ],
  'فنون وثقافة': [
    'الهوره والموسيقى الفيلية',
    'الشعر والأدب الفيلي',
    'اللهجة الفيلية واللغويات',
    'التراث الشعبي والأزياء',
    'المسرح والسينما'
  ],
  'أماكن ومدن': [
    'مدن محافظة ديالى',
    'مدن محافظة واسط',
    'محلات بغداد التاريخية',
    'محافظة ميسان والجنوب',
    'إيلام ولورستان وكرمنشاه'
  ],
  'أحداث تاريخية': [
    'التهجير القسري والذاكرة',
    'التاريخ الحديث للعراق',
    'الاعتراف القانوني والعدالة',
    'الوثائق والأرشيف التاريخي'
  ],
  'إعلام وسياسة': [
    'الصحافة والنشر الفيلي',
    'مراكز الدراسات الاستراتيجية',
    'السياسات الرقمية والأمن السيبراني',
    'العمل المدني والبرلماني'
  ]
};

export interface MemberAccount {
  id: string;
  name: string;
  roleTitle: string;
  specialty: string;
  status: 'active' | 'suspended';
  joinedAt: string;
}

export interface SystemSettings {
  siteName: string;
  siteSubtitle: string;
  requireMemberApproval: boolean;
  allowImageUrls: boolean;
  defaultProtectionLevel: ProtectionLevel;
  announcementBanner: string;
}

export interface ArticleSection {
  id: string;
  title: string;
  content: string;
}

export interface ArticleReference {
  id: number;
  text: string;
}

export interface TalkMessage {
  id: string;
  author: string;
  role: UserRole;
  topic?: string;
  text: string;
  createdAt: string;
}

export interface InfoboxRow {
  label: string;
  value: string;
}

export interface ArticleSnapshot {
  name: string;
  subtitle: string;
  portal: WikiPortal;
  /** نوع المقال الذي يحدد الحقول المخصصة في النموذج وصندوق المعلومات */
  articleType?: ArticleType;
  summary: string;
  field: string;
  activeYears: string;
  /** حقول خاصة بالمقالات من نوع «شخصية» */
  birthDate?: string;
  deathDate?: string;
  birthDeath: string;
  birthplace: string;
  clanAffiliation?: string;
  /** حقول خاصة بالمقالات من نوع «منطقة» */
  geographicLocation?: string;
  administrativeRegion?: string;
  coordinates?: string;
  populationEstimate?: string;
  relatedClans?: string;
  /** حقل خاص بالموضوعات العامة والعشائر والأحداث */
  historicalEra?: string;
  notableWorks: string;
  infoboxRows?: InfoboxRow[];
  imageUrl?: string;
  imageCaption?: string;
  categories: string[];
  /** التصنيفات الفرعية الدقيقة التابعة للبوابة والتصنيفات الرئيسية */
  subcategories?: string[];
  /** وسم «بذرة» للمقالات القصيرة أو غير المكتملة (true: بذرة يدوية، false: مكتملة، undefined: تقييم تلقائي حسب طول المحتوى) */
  isStub?: boolean;
  /** وسم «بحاجة لمصادر» لتنبيه المحررين والزوار إلى ضرورة تدعيم المقالة بالمراجع الموثوقة */
  needsSources?: boolean;
  /** وسم «مقالة متميزة» لاعتماد المقالة كمرجع متكامل وموثّق في الموسوعة */
  isFeatured?: boolean;
  sections: ArticleSection[];
  references: ArticleReference[];
}

export type QuickEditorialTagKey = 'isStub' | 'needsSources' | 'isFeatured';

export interface StubEvaluation {
  isStub: boolean;
  reason: 'manual' | 'auto' | 'complete';
  wordCount: number;
  charCount: number;
  sectionCount: number;
  referenceCount: number;
}

export const STUB_CHAR_THRESHOLD = 950;

export function evaluateArticleStubStatus(
  snap: Partial<ArticleSnapshot>
): StubEvaluation {
  const summaryText = (snap.summary ?? '').replace(/\[\d+\]/g, '').trim();
  const validSections = (Array.isArray(snap.sections) ? snap.sections : []).filter(
    (s) => Boolean(s?.content?.trim())
  );
  const sectionsText = validSections
    .map((s) => `${s.title ?? ''} ${s.content ?? ''}`.replace(/\[\d+\]/g, '').trim())
    .join(' ');
  const combinedText = `${summaryText} ${sectionsText}`.replace(/\s+/g, ' ').trim();
  const charCount = combinedText.length;
  const wordCount = combinedText ? combinedText.split(' ').filter(Boolean).length : 0;
  const sectionCount = validSections.length;
  const referenceCount = (Array.isArray(snap.references) ? snap.references : []).filter(
    (r) => Boolean(r?.text?.trim())
  ).length;

  if (snap.isStub === true) {
    return {
      isStub: true,
      reason: 'manual',
      wordCount,
      charCount,
      sectionCount,
      referenceCount
    };
  }

  if (snap.isStub === false) {
    return {
      isStub: false,
      reason: 'complete',
      wordCount,
      charCount,
      sectionCount,
      referenceCount
    };
  }

  // التقييم التلقائي: المقالات القصيرة (أقل من 950 حرفاً أو قسم واحد بمحتوى مختصر) تُوسم تلقائياً كـ «بذرة»
  const isAutoShort =
    charCount < STUB_CHAR_THRESHOLD || (sectionCount <= 1 && charCount < 1300);

  return {
    isStub: isAutoShort,
    reason: isAutoShort ? 'auto' : 'complete',
    wordCount,
    charCount,
    sectionCount,
    referenceCount
  };
}

export function isEffectiveStub(snap: Partial<ArticleSnapshot>): boolean {
  return evaluateArticleStubStatus(snap).isStub;
}

export function getEffectiveSubcategories(snap: Partial<ArticleSnapshot>): string[] {
  if (Array.isArray(snap.subcategories)) {
    return snap.subcategories.map((s) => s.trim()).filter(Boolean);
  }
  const inferred: string[] = [];
  const hay = `${snap.name ?? ''} ${snap.subtitle ?? ''} ${snap.field ?? ''} ${(snap.categories ?? []).join(' ')}`;

  if (/أركوازي|اركواز/.test(hay)) inferred.push('عشائر الأركوازي');
  if (/زنكنة|زنكنه/.test(hay)) inferred.push('عشائر الزنكنة والباوية');
  if (/كلهور|ملك شاهي|لور|كردلية|عشائر الفيلية/.test(hay)) {
    inferred.push('عشائر اللور والكردلية');
    if (/كلهور/.test(hay)) inferred.push('عشائر الكلهور');
    if (/ملك شاهي/.test(hay)) inferred.push('عشائر ملك شاهي');
  }
  if (/شاعر|شعراء|شعر|أدب|الأدب/.test(hay)) inferred.push('شعراء وأدباء');
  if (/أكاديمي|دكتور|الدكتور|جامعة|العلوم والتربية|علم النفس/.test(hay)) {
    inferred.push('أكاديميون وباحثون');
  }
  if (/مفكر|مؤرخ|مترجم|التاريخ والمجتمع/.test(hay) && snap.portal === 'شخصيات وأعلام') {
    inferred.push('مفكرون ومؤرخون');
  }
  if (/المرأة في التاريخ|ليلى قاسم|وطنية/.test(hay)) inferred.push('شخصيات وطنية ومجتمعية');
  if (/سيبراني|رقمية|التقنية/.test(hay)) inferred.push('تقنية وسياسات رقمية');
  if (/صحافة|ناشر|المدى|إعلامي/.test(hay)) inferred.push('الصحافة والنشر الفيلي');
  if (/الدراسات الاستراتيجية|محلل سياسي/.test(hay)) inferred.push('مراكز الدراسات الاستراتيجية');
  if (/خانقين|مندلي|ديالى/.test(hay) && snap.portal === 'أماكن ومدن') {
    inferred.push('مدن محافظة ديالى');
  }
  if (/بدرة|واسط|جصان/.test(hay) && snap.portal === 'أماكن ومدن') {
    inferred.push('مدن محافظة واسط');
  }
  if (/بغداد/.test(hay) && snap.portal === 'أماكن ومدن') {
    inferred.push('محلات بغداد التاريخية');
  }
  if (/هوره|مور|موسيقى|غناء/.test(hay)) inferred.push('الهوره والموسيقى الفيلية');
  if (/لهجة|لغويات|لغة/.test(hay) && snap.portal === 'فنون وثقافة') {
    inferred.push('اللهجة الفيلية واللغويات');
  }
  if (/تهجير|إسقاط الجنسية|الإبادة/.test(hay)) {
    inferred.push('التهجير القسري والذاكرة');
    inferred.push('الاعتراف القانوني والعدالة');
  }

  if (inferred.length === 0 && snap.portal && PORTAL_SUBCATEGORY_SUGGESTIONS[snap.portal]?.[0]) {
    inferred.push(PORTAL_SUBCATEGORY_SUGGESTIONS[snap.portal][0]);
  }

  return Array.from(new Set(inferred));
}

export function inferArticleType(snap: Partial<ArticleSnapshot>): ArticleType {
  if (
    snap.articleType === 'person' ||
    snap.articleType === 'place' ||
    snap.articleType === 'general'
  ) {
    return snap.articleType;
  }
  if (snap.portal === 'أماكن ومدن') {
    return 'place';
  }
  if (snap.portal === 'شخصيات وأعلام') {
    return 'person';
  }
  if (snap.geographicLocation?.trim() || snap.administrativeRegion?.trim() || snap.coordinates?.trim()) {
    return 'place';
  }
  if (snap.birthDate?.trim() || snap.deathDate?.trim()) {
    return 'person';
  }
  if (snap.portal === 'إعلام وسياسة') {
    const bd = (snap.birthDeath ?? '').trim();
    const sub = (snap.subtitle ?? '').trim();
    if (
      /مواليد|\d{4}\s*[–\-]\s*\d{4}|كاتب|صحفي|إعلامي|سياسي|ناشر|باحث/.test(`${bd} ${sub}`)
    ) {
      return 'person';
    }
  }
  return 'general';
}

export function formatPersonLifespan(snap: Partial<ArticleSnapshot>): string {
  const birth = (snap.birthDate ?? '').trim();
  const death = (snap.deathDate ?? '').trim();
  if (birth && death) {
    return `${birth} – ${death}`;
  }
  if (birth) {
    return /^مواليد|وُلد|ولد/.test(birth) ? birth : `مواليد ${birth}`;
  }
  if (death) {
    return `توفي ${death}`;
  }
  return (snap.birthDeath ?? '').trim();
}

export function getPlaceLocationSummary(snap: Partial<ArticleSnapshot>): string {
  const geo = (snap.geographicLocation ?? '').trim();
  const admin = (snap.administrativeRegion ?? '').trim();
  if (geo && admin && !geo.includes(admin)) {
    return `${geo} (${admin})`;
  }
  if (geo) return geo;
  if (admin) return admin;
  return (snap.birthplace ?? '').trim();
}

export interface RevisionSnapshot {
  id: string;
  timestamp: string;
  author: string;
  approver?: string;
  summary: string;
  status?: 'approved' | 'rejected';
  rejectReason?: string;
  snapshot: ArticleSnapshot;
}

export interface Article extends ArticleSnapshot {
  id: string;
  initials: string;
  accentTone: AccentTone;
  updatedAt: string;
  protectionLevel: ProtectionLevel;
  designatedApprovers: string[];
  talkMessages: TalkMessage[];
  history: RevisionSnapshot[];
}

export interface PendingRevision {
  id: string;
  type: 'edit' | 'new_article';
  articleId: string;
  articleName: string;
  author: string;
  summary: string;
  submittedAt: string;
  proposedData: ArticleSnapshot;
  originalData?: ArticleSnapshot;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  accentTone?: AccentTone;
  designatedApprovers?: string[];
  protectionLevel?: ProtectionLevel;
}

export interface ArticleDailyBucket {
  date: string; // YYYY-MM-DD
  views: number;
  interactions: number;
}

export interface ArticleMetricRecord {
  articleId: string;
  totalViews: number;
  totalInteractions: number;
  dailyBuckets: ArticleDailyBucket[];
  lastVisitedAt: string;
}

export interface EncyclopediaState {
  version: number;
  articles: Article[];
  pendingRevisions: PendingRevision[];
  reviewLog: PendingRevision[];
  members: MemberAccount[];
  activeMemberName: string;
  userRole: UserRole;
  settings: SystemSettings;
}
