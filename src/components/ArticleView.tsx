import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  Edit3,
  FileWarning,
  GitPullRequest,
  History,
  Image as ImageIcon,
  Info,
  Link2,
  List,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  Sprout,
  Star,
  Tags,
  Trash2,
  User,
  XCircle
} from 'lucide-react';
import {
  ARTICLE_TYPE_OPTIONS,
  Article,
  ArticleReference,
  ArticleSection,
  ArticleSnapshot,
  ArticleType,
  MemberAccount,
  PORTAL_SUBCATEGORY_SUGGESTIONS,
  PendingRevision,
  ProtectionLevel,
  QuickEditorialTagKey,
  SystemSettings,
  WIKI_PORTALS,
  WikiPortal,
  evaluateArticleStubStatus,
  formatPersonLifespan,
  getEffectiveSubcategories,
  getPlaceLocationSummary,
  inferArticleType
} from '../types/encyclopedia';
import { buildDiffComparison } from '../utils/diff';
import {
  getAbsoluteUrl,
  getArticlePath,
  getCategoryPath,
  getHomePath,
  getPortalPath,
  getSubcategoryPath,
  shouldHandleClientNavigation
} from '../utils/routes';
import { sanitizeImageUrl, validateImageUrl } from '../utils/storage';
import { buildArticleToc, scrollToTocAnchor } from '../utils/toc';
import { CitationText } from './CitationText';
import { ImageLoadStatus, PortraitMedallion, SmartExternalImage } from './PortraitMedallion';

function renderReferenceText(text: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, idx) => {
    if (part.startsWith('http://') || part.startsWith('https://')) {
      const cleaned = part.replace(/[.)،؛]+$/, '');
      const trailing = part.slice(cleaned.length);
      try {
        const parsed = new URL(cleaned);
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
          return (
            <React.Fragment key={idx}>
              <a
                href={parsed.toString()}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="text-[#3366cc] hover:underline break-all inline-block"
              >
                {cleaned}
              </a>
              {trailing}
            </React.Fragment>
          );
        }
      } catch {
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      }
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export type ArticleTab = 'read' | 'edit' | 'history' | 'talk' | 'control';

interface ArticleViewProps {
  article: Article;
  pendingForArticle: PendingRevision[];
  members: MemberAccount[];
  activeMemberName: string;
  activeTab: ArticleTab;
  isAdminSession: boolean;
  showPageControlTab?: boolean;
  isSignedIn?: boolean;
  userDisplayName?: string | null;
  onSignIn?: () => void;
  settings: SystemSettings;
  canDeleteArticle: boolean;
  existingTitles?: string[];
  onWikiLinkClick?: (targetTitle: string) => void;
  resolveWikiLinkHref?: (targetTitle: string) => string | null;
  onNavigateHome?: () => void;
  onTabChange: (tab: ArticleTab) => void;
  onSelectPortal: (portal: WikiPortal) => void;
  onSelectCategory: (category: string) => void;
  onSelectSubcategory?: (subcategory: string) => void;
  onSubmitEditProposal: (payload: {
    articleId: string;
    proposedData: ArticleSnapshot;
    author: string;
    summary: string;
    publishDirectly: boolean;
  }) => void;
  onApproveRevision: (revisionId: string) => void;
  onRejectRevision: (revisionId: string, reason: string) => void;
  onAddTalkMessage: (payload: {
    articleId: string;
    author: string;
    topic: string;
    text: string;
  }) => void;
  onUpdatePageControls: (payload: {
    articleId: string;
    portal: WikiPortal;
    protectionLevel: ProtectionLevel;
    designatedApprovers: string[];
    imageUrl: string;
    imageCaption: string;
    categories: string[];
    subcategories?: string[];
    isStub?: boolean;
  }) => void;
  onQuickToggleTag?: (
    articleId: string,
    tag: QuickEditorialTagKey,
    nextValue: boolean
  ) => Promise<void> | void;
  onDeleteArticle: (articleId: string) => void;
}

const PERSON_STANDARD_INFOBOX_LABELS = new Set([
  'الاسم الكامل',
  'الصفة / اللقب',
  'الميلاد والوفاة',
  'الميلاد',
  'الوفاة',
  'مكان الولادة والنشأة',
  'مكان الميلاد والنشأة',
  'المجال / التخصص',
  'سنوات النشاط',
  'العشيرة / الانتماء',
  'الانتماء العشائري',
  'أبرز الأعمال والمناصب'
]);

const PLACE_STANDARD_INFOBOX_LABELS = new Set([
  'المنطقة / المدينة',
  'الصفة الجغرافية',
  'الموقع الجغرافي',
  'الموقع الإداري',
  'المحافظة / الإقليم',
  'الإحداثيات الجغرافية',
  'التقدير السكاني',
  'العمق التاريخي',
  'الامتداد الزمني',
  'الامتداد التاريخي',
  'أبرز المعالم',
  'العشائر والأعلام المرتبطة'
]);

export function ArticleView({
  article,
  pendingForArticle,
  members,
  activeMemberName,
  activeTab,
  isAdminSession,
  showPageControlTab = false,
  isSignedIn = true,
  userDisplayName,
  onSignIn,
  settings,
  canDeleteArticle,
  existingTitles = [],
  onWikiLinkClick,
  resolveWikiLinkHref,
  onNavigateHome,
  onTabChange,
  onSelectPortal,
  onSelectCategory,
  onSelectSubcategory,
  onSubmitEditProposal,
  onApproveRevision,
  onRejectRevision,
  onAddTalkMessage,
  onUpdatePageControls,
  onQuickToggleTag,
  onDeleteArticle
}: ArticleViewProps) {
  const [highlightedRef, setHighlightedRef] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isTocCollapsed, setIsTocCollapsed] = useState(false);
  const [activeTocId, setActiveTocId] = useState<string>('sec-intro');
  const [copiedAnchorId, setCopiedAnchorId] = useState<string | null>(null);
  const [savingQuickTag, setSavingQuickTag] = useState<QuickEditorialTagKey | null>(null);

  const articleType = inferArticleType(article);
  const portalHref = getPortalPath(article.portal);
  const articlePermalink = getAbsoluteUrl(getArticlePath(article.id, 'read'));
  const toc = useMemo(() => buildArticleToc(article), [article]);
  const effectiveSubcategories = useMemo(() => getEffectiveSubcategories(article), [article]);
  const stubStatus = useMemo(() => evaluateArticleStubStatus(article), [article]);

  useEffect(() => {
    if (highlightedRef === null) return;
    const timer = window.setTimeout(() => setHighlightedRef(null), 2200);
    return () => window.clearTimeout(timer);
  }, [highlightedRef]);

  useEffect(() => {
    if (!copiedLink) return;
    const timer = window.setTimeout(() => setCopiedLink(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copiedLink]);

  useEffect(() => {
    if (!copiedAnchorId) return;
    const timer = window.setTimeout(() => setCopiedAnchorId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copiedAnchorId]);

  // التمرير التلقائي للقسم المحدد في رابط الـ Hash عند فتح المقال مباشرة
  useEffect(() => {
    if (activeTab !== 'read' || typeof window === 'undefined') return;
    const rawHash = window.location.hash;
    if (!rawHash || rawHash.startsWith('#/')) return;
    let decodedId = rawHash.slice(1);
    try {
      decodedId = decodeURIComponent(decodedId);
    } catch {
      // keep raw hash id
    }
    if (!decodedId) return;
    const timer = window.setTimeout(() => {
      if (scrollToTocAnchor(decodedId, false)) {
        setActiveTocId(decodedId);
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [article.id, activeTab]);

  // تتبّع القسم الظاهر حالياً أثناء التمرير لتحديث حالة فهرس المحتويات
  useEffect(() => {
    if (activeTab !== 'read' || typeof IntersectionObserver === 'undefined') return;
    const elements = toc.allAnchorIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target?.id) {
          setActiveTocId(visible[0].target.id);
        }
      },
      {
        rootMargin: '-84px 0px -65% 0px',
        threshold: 0
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [activeTab, toc.allAnchorIds]);

  const handleJumpToSection = (anchorId: string, copyLink = false) => {
    setActiveTocId(anchorId);
    scrollToTocAnchor(anchorId, true);
    if (copyLink) {
      const sectionUrl = `${articlePermalink}#${encodeURIComponent(anchorId)}`;
      navigator.clipboard?.writeText?.(sectionUrl).then(
        () => setCopiedAnchorId(anchorId),
        () => setCopiedAnchorId(null)
      );
    }
  };

  const handleCopyPermalink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(articlePermalink);
        setCopiedLink(true);
      }
    } catch {
      setCopiedLink(false);
    }
  };

  const handleCitationClick = (refId: number) => {
    setHighlightedRef(refId);
    const el = document.getElementById(`ref-${refId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleQuickTagClick = async (tag: QuickEditorialTagKey, nextValue: boolean) => {
    if (!onQuickToggleTag || savingQuickTag) return;
    setSavingQuickTag(tag);
    try {
      await onQuickToggleTag(article.id, tag, nextValue);
    } finally {
      setSavingQuickTag(null);
    }
  };

  const latestRevision = article.history[article.history.length - 1];

  const extraPersonRows = useMemo(() => {
    if (articleType !== 'person' || !article.infoboxRows?.length) return [];
    return article.infoboxRows.filter((row) => !PERSON_STANDARD_INFOBOX_LABELS.has(row.label));
  }, [articleType, article.infoboxRows]);

  const extraPlaceRows = useMemo(() => {
    if (articleType !== 'place' || !article.infoboxRows?.length) return [];
    return article.infoboxRows.filter((row) => !PLACE_STANDARD_INFOBOX_LABELS.has(row.label));
  }, [articleType, article.infoboxRows]);

  const personLifespanFallback =
    !article.birthDate?.trim() && !article.deathDate?.trim()
      ? (article.birthDeath ?? '').trim()
      : '';

  return (
    <div className="space-y-3">
      {/* مسار التنقل الهيكلي (SEO Breadcrumb) + رابط المقال الدائم */}
      <nav
        aria-label="مسار التصفح"
        className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#54595d]"
      >
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <a
              href={getHomePath()}
              onClick={(e) => {
                if (onNavigateHome && shouldHandleClientNavigation(e)) {
                  e.preventDefault();
                  onNavigateHome();
                }
              }}
              className="text-[#3366cc] hover:underline"
            >
              الرئيسية
            </a>
          </li>
          <li aria-hidden="true">
            <ChevronLeft className="w-3 h-3 text-[#a2a9b1]" />
          </li>
          <li>
            <a
              href={portalHref}
              onClick={(e) => {
                if (shouldHandleClientNavigation(e)) {
                  e.preventDefault();
                  onSelectPortal(article.portal);
                }
              }}
              className="text-[#3366cc] hover:underline"
            >
              بوابة {article.portal}
            </a>
          </li>
          <li aria-hidden="true">
            <ChevronLeft className="w-3 h-3 text-[#a2a9b1]" />
          </li>
          <li aria-current="page" className="text-[#202122] font-medium truncate max-w-[260px]">
            {article.name}
          </li>
        </ol>

        <button
          type="button"
          onClick={handleCopyPermalink}
          className="inline-flex items-center gap-1 text-[11px] text-[#54595d] hover:text-[#3366cc] transition cursor-pointer"
          title={`نسخ الرابط الدائم: ${articlePermalink}`}
        >
          {copiedLink ? (
            <>
              <Check className="w-3 h-3 text-[#14866d]" aria-hidden="true" />
              <span className="text-[#14866d] font-medium">تم نسخ رابط المقال</span>
            </>
          ) : (
            <>
              <Link2 className="w-3 h-3" aria-hidden="true" />
              <span>نسخ رابط المقال</span>
            </>
          )}
        </button>
      </nav>

      {/* 1. عنوان المقالة المستقل خارج الصندوق الرئيسي (Vector 2022 firstHeading) */}
      <header className="border-b border-[#a2a9b1] pb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="wiki-title text-[28px] sm:text-[34px] leading-[1.25] font-bold text-[#202122] tracking-tight">
          {article.name}
        </h1>

        <div className="flex items-center gap-3 text-xs text-[#54595d]">
          <a
            href={portalHref}
            onClick={(e) => {
              if (shouldHandleClientNavigation(e)) {
                e.preventDefault();
                onSelectPortal(article.portal);
              }
            }}
            className="text-[#3366cc] hover:underline font-medium"
          >
            بوابة {article.portal}
          </a>
          <span aria-hidden="true" className="text-[#c8ccd1]">·</span>
          {article.isFeatured && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-[#eefaf5] border border-[#9fd5c8] text-[#0e6b57] font-bold text-[11px]"
              title="مقالة متميزة ومعتمدة كمرجع موثّق في ويكي فيلي"
            >
              <Star className="w-3.5 h-3.5 text-[#14866d] fill-[#14866d]" aria-hidden="true" />
              <span>مقالة متميزة</span>
            </span>
          )}
          {stubStatus.isStub && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-amber-50 border border-amber-300 text-[#8a5300] font-bold text-[11px]"
              title={
                stubStatus.reason === 'manual'
                  ? 'موسومة كبذرة — مقالة قصيرة تحتاج إثراءً وتطويرًا'
                  : 'مقالة قصيرة موسومة تلقائياً كبذرة وتحتاج إلى إثراء'
              }
            >
              <Sprout className="w-3.5 h-3.5 text-[#ac6600]" aria-hidden="true" />
              <span>بذرة</span>
            </span>
          )}
          {article.needsSources && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-[#fef2f2] border border-[#f2c2c2] text-[#9b1c1c] font-bold text-[11px]"
              title="هذه المقالة بحاجة إلى تدعيم إضافي بالمصادر والمراجع الموثوقة"
            >
              <FileWarning className="w-3.5 h-3.5 text-[#b32424]" aria-hidden="true" />
              <span>بحاجة لمصادر</span>
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 text-[#54595d]"
            title="تخضع هذه الصفحة لإشراف الأعضاء المعتمدين قبل نشر التعديلات"
          >
            <BadgeCheck className="w-3.5 h-3.5 text-[#3366cc]" aria-hidden="true" />
            <span>
              {article.protectionLevel === 'strict-review'
                ? 'مراجعة مشددة'
                : article.protectionLevel === 'open'
                  ? 'مفتوحة التوثيق'
                  : 'محمية جزئياً'}
            </span>
          </span>
        </div>
      </header>

      {/* 2. شريط تبويبات Vector 2022 أسفل العنوان مباشرة */}
      <nav
        aria-label="أدوات المقالة"
        className="flex flex-wrap items-center justify-between border-b border-[#eaecf0] gap-y-1"
      >
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => onTabChange('read')}
            className={`wiki-tab flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'read' ? 'active' : ''
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            <span>المقالة</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('talk')}
            className={`wiki-tab flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'talk' ? 'active' : ''
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
            <span>نقاش</span>
            <span className="font-mono-tabular text-[11px] text-[#54595d]">
              ({article.talkMessages.length})
            </span>
          </button>
        </div>

        <div className="flex items-center gap-5 overflow-x-auto">
          <button
            type="button"
            onClick={() => onTabChange('read')}
            className={`wiki-tab hidden sm:flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              activeTab === 'read' ? 'active' : ''
            }`}
          >
            <span>اقرأ</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('edit')}
            className={`wiki-tab flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'edit' ? 'active' : ''
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>اقترح تعديلاً</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('history')}
            className={`wiki-tab flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'history' ? 'active' : ''
            }`}
          >
            <History className="w-3.5 h-3.5" aria-hidden="true" />
            <span>تاريخ المراجعات</span>
            {pendingForArticle.length > 0 && (
              <span className="font-mono-tabular text-[11px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 rounded-xs font-bold">
                {pendingForArticle.length} معلق
              </span>
            )}
          </button>
          {showPageControlTab && isAdminSession && (
            <button
              type="button"
              onClick={() => onTabChange('control')}
              className={`wiki-tab flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'control' ? 'active' : ''
              }`}
            >
              <Settings className="w-3.5 h-3.5" aria-hidden="true" />
              <span>تحكم الصفحة</span>
            </button>
          )}
        </div>
      </nav>

      {/* 3. سطر التعريف الموسوعي (Vector 2022 siteSub) + شريط الإشراف المدمج */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#54595d] pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <span>من {settings.siteName}، الموسوعة الحرة</span>
          {latestRevision && (
            <>
              <span aria-hidden="true" className="text-[#c8ccd1]">·</span>
              <span className="text-[11px] font-mono-tabular">
                آخر مراجعة: {latestRevision.timestamp}
                {latestRevision.approver ? ` (${latestRevision.approver})` : ''}
              </span>
            </>
          )}
        </div>

        {pendingForArticle.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => onTabChange('history')}
              className="text-[#3366cc] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <GitPullRequest className="w-3 h-3" aria-hidden="true" />
              <span>{pendingForArticle.length} مساهمة بانتظار المراجعة</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. تبويب القراءة (Vector 2022 Body Layout) */}
      {(activeTab === 'read' ||
        (activeTab === 'control' && !(showPageControlTab && isAdminSession))) && (
        <div className="space-y-4 pt-1">
          {/* شريط الوسم السريع للمشرفين — تحديث فوري للحالة في قاعدة البيانات بنقرة واحدة */}
          {isAdminSession && onQuickToggleTag && (
            <section
              aria-label="شريط الوسم السريع للمشرفين"
              className="bg-[#f8f9fa] border border-[#c8ccd1] rounded-xs px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 text-xs">
                <Tags className="w-4 h-4 text-[#3366cc] shrink-0" aria-hidden="true" />
                <span className="font-bold text-[#202122]">الوسم السريع للمشرف:</span>
                <span className="hidden sm:inline text-[11px] text-[#54595d]">
                  نقرة واحدة لتحديث حالة المقالة مباشرة في قاعدة البيانات
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={savingQuickTag !== null}
                  aria-pressed={stubStatus.isStub}
                  onClick={() => handleQuickTagClick('isStub', !stubStatus.isStub)}
                  className={`px-2.5 py-1.5 rounded text-xs font-bold border inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60 ${
                    stubStatus.isStub
                      ? 'bg-[#fef9e7] border-[#ac6600] text-[#7a4b00] shadow-xs'
                      : 'bg-white border-[#c8ccd1] text-[#202122] hover:border-[#ac6600] hover:text-[#7a4b00]'
                  }`}
                  title={stubStatus.isStub ? 'انقر لإزالة وسم بذرة' : 'انقر لوسم المقالة كبذرة'}
                >
                  {savingQuickTag === 'isStub' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sprout className="w-3.5 h-3.5 text-[#ac6600]" aria-hidden="true" />
                  )}
                  <span>{stubStatus.isStub ? '✓ بذرة' : '+ بذرة'}</span>
                </button>

                <button
                  type="button"
                  disabled={savingQuickTag !== null}
                  aria-pressed={Boolean(article.needsSources)}
                  onClick={() => handleQuickTagClick('needsSources', !article.needsSources)}
                  className={`px-2.5 py-1.5 rounded text-xs font-bold border inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60 ${
                    article.needsSources
                      ? 'bg-[#fef2f2] border-[#b32424] text-[#9b1c1c] shadow-xs'
                      : 'bg-white border-[#c8ccd1] text-[#202122] hover:border-[#b32424] hover:text-[#9b1c1c]'
                  }`}
                  title={
                    article.needsSources
                      ? 'انقر لإزالة وسم بحاجة لمصادر'
                      : 'انقر لوسم المقالة بأنها بحاجة لمصادر'
                  }
                >
                  {savingQuickTag === 'needsSources' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <FileWarning className="w-3.5 h-3.5 text-[#b32424]" aria-hidden="true" />
                  )}
                  <span>{article.needsSources ? '✓ بحاجة لمصادر' : '+ بحاجة لمصادر'}</span>
                </button>

                <button
                  type="button"
                  disabled={savingQuickTag !== null}
                  aria-pressed={Boolean(article.isFeatured)}
                  onClick={() => handleQuickTagClick('isFeatured', !article.isFeatured)}
                  className={`px-2.5 py-1.5 rounded text-xs font-bold border inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60 ${
                    article.isFeatured
                      ? 'bg-[#eefaf5] border-[#14866d] text-[#0e6b57] shadow-xs'
                      : 'bg-white border-[#c8ccd1] text-[#202122] hover:border-[#14866d] hover:text-[#0e6b57]'
                  }`}
                  title={
                    article.isFeatured
                      ? 'انقر لإزالة وسم مقالة متميزة'
                      : 'انقر لوسم المقالة كمقالة متميزة'
                  }
                >
                  {savingQuickTag === 'isFeatured' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Star
                      className={`w-3.5 h-3.5 text-[#14866d] ${
                        article.isFeatured ? 'fill-[#14866d]' : ''
                      }`}
                      aria-hidden="true"
                    />
                  )}
                  <span>{article.isFeatured ? '✓ مقالة متميزة' : '+ مقالة متميزة'}</span>
                </button>
              </div>
            </section>
          )}

          {/* تنبيه وسم «مقالة متميزة» */}
          {article.isFeatured && (
            <aside
              role="note"
              aria-label="مقالة متميزة"
              className="bg-[#eefaf5] border border-[#9fd5c8] border-r-4 border-r-[#14866d] rounded-xs px-4 py-3 flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded bg-[#dcf3ea] border border-[#9fd5c8] flex items-center justify-center shrink-0">
                <Star className="w-4 h-4 text-[#14866d] fill-[#14866d]" aria-hidden="true" />
              </div>
              <div className="text-xs leading-relaxed text-[#0e4e40]">
                <strong className="font-bold text-[#0b3e33]">مقالة متميزة في ويكي فيلي:</strong>{' '}
                تم اختيار هذه المقالة واعتمادها ضمن المقالات المتميزة لاستيفائها معايير التوثيق
                الموسوعي والدقة التاريخية وتعدد المراجع الموثوقة.
              </div>
            </aside>
          )}

          {/* تنبيه وسم «بحاجة لمصادر» */}
          {article.needsSources && (
            <aside
              role="note"
              aria-label="تنبيه بحاجة لمصادر"
              className="bg-[#fef2f2] border border-[#f2c2c2] border-r-4 border-r-[#b32424] rounded-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded bg-red-100 border border-[#f2c2c2] flex items-center justify-center shrink-0 mt-0.5">
                  <FileWarning className="w-5 h-5 text-[#b32424]" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-[#7a1616]">
                    هذه المقالة بحاجة إلى مصادر ومراجع موثوقة
                  </h2>
                  <p className="text-xs leading-relaxed text-[#6b2121]">
                    تحتاج المعلومات الواردة في مقالة <strong>«{article.name}»</strong> إلى مزيد من
                    الاستشهادات بمصادر تاريخية أو أكاديمية أو صحفية موثوقة للتحقق من دقتها
                    الموسوعية.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => onTabChange('edit')}
                  className="px-3.5 py-1.5 bg-[#b32424] hover:bg-[#8f1b1b] text-white text-xs font-bold rounded inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>أضف مصادر للمقالة</span>
                </button>
              </div>
            </aside>
          )}

          {/* تنبيه وسم «بذرة» المرئي أعلى المقالة القصيرة لتشجيع الزوار على إثرائها */}
          {stubStatus.isStub && (
            <aside
              role="note"
              aria-label="تنبيه مقالة بذرة"
              className="bg-[#fef9e7] border border-[#e2c98d] border-r-4 border-r-[#ac6600] rounded-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded bg-amber-100 border border-[#e2c98d] flex items-center justify-center shrink-0 mt-0.5">
                  <Sprout className="w-5 h-5 text-[#9a5b00]" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-[#613900]">
                      هذه المقالة «بذرة» قصيرة ولم تكتمل بعد
                    </h2>
                    <span className="text-[11px] font-mono-tabular px-1.5 py-0.5 rounded-xs bg-white/80 border border-[#e2c98d] text-[#7a4b00]">
                      {stubStatus.reason === 'manual'
                        ? 'وسم بذرة يدوي'
                        : `تلقائي · ${stubStatus.wordCount} كلمة`}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-[#5c3d0e]">
                    لا يزال محتوى مقالة <strong>«{article.name}»</strong> مختصراً ويحتاج إلى مزيد
                    من المعلومات الموثقة والأقسام التفصيلية والمراجع. يمكنك المساهمة في توثيق
                    التراث الفيلي وتطوير هذه الصفحة بإضافة مصادر أو فقرات جديدة.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => onTabChange('edit')}
                  className="px-3.5 py-1.5 bg-[#ac6600] hover:bg-[#8a5200] text-white text-xs font-bold rounded inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>ساهم في إثراء المقالة</span>
                </button>
                <button
                  type="button"
                  onClick={() => onTabChange('talk')}
                  className="px-3 py-1.5 bg-white hover:bg-amber-50 text-[#7a4b00] border border-[#d6b872] text-xs font-semibold rounded inline-flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                >
                  <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>ناقش المصادر</span>
                </button>
              </div>
            </aside>
          )}

          <div className="flex flex-col md:flex-row-reverse gap-7 items-start">
          {/* صندوق المعلومات الجانبي (Wikipedia Infobox — يتكيف ديناميكياً حسب نوع المقال) */}
          <aside
            aria-label="صندوق المعلومات"
            className="w-full md:w-[300px] shrink-0 infobox rounded-xs overflow-hidden"
          >
            <div className="bg-[#dce6f2] text-[#202122] font-bold text-center py-1.5 px-3 text-xs border-b border-[#a2a9b1] flex items-center justify-center gap-1.5">
              {articleType === 'person' ? (
                <>
                  <User className="w-3.5 h-3.5 text-[#2a4b8d]" aria-hidden="true" />
                  <span>بطاقة بيانات الشخصية</span>
                </>
              ) : articleType === 'place' ? (
                <>
                  <MapPin className="w-3.5 h-3.5 text-[#14866d]" aria-hidden="true" />
                  <span>بطاقة البيانات الجغرافية</span>
                </>
              ) : (
                <span>بطاقة البيانات الموسوعية</span>
              )}
            </div>

            <div className="p-3.5 bg-white flex flex-col items-center border-b border-[#eaecf0]">
              <PortraitMedallion
                articleId={article.id}
                initials={article.initials}
                name={article.name}
                tone={article.accentTone}
                imageUrl={article.imageUrl}
                size="lg"
              />
              <span className="text-[11px] leading-snug text-[#54595d] mt-2 text-center">
                {article.imageCaption || article.subtitle}
              </span>
            </div>

            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <th>البوابة</th>
                  <td>
                    <a
                      href={portalHref}
                      onClick={(e) => {
                        if (shouldHandleClientNavigation(e)) {
                          e.preventDefault();
                          onSelectPortal(article.portal);
                        }
                      }}
                      className="text-[#3366cc] hover:underline text-right"
                    >
                      {article.portal}
                    </a>
                  </td>
                </tr>

                {articleType === 'person' && (
                  <>
                    <tr>
                      <th>نوع المقال</th>
                      <td>شخصية وعلم</td>
                    </tr>
                    {article.subtitle && (
                      <tr>
                        <th>الصفة / اللقب</th>
                        <td>{article.subtitle}</td>
                      </tr>
                    )}
                    {article.birthDate?.trim() && (
                      <tr>
                        <th>الميلاد</th>
                        <td className="font-mono-tabular">{article.birthDate}</td>
                      </tr>
                    )}
                    {article.deathDate?.trim() && (
                      <tr>
                        <th>الوفاة</th>
                        <td className="font-mono-tabular">{article.deathDate}</td>
                      </tr>
                    )}
                    {personLifespanFallback && personLifespanFallback !== 'غير محدد' && (
                      <tr>
                        <th>الميلاد والوفاة</th>
                        <td className="font-mono-tabular">{personLifespanFallback}</td>
                      </tr>
                    )}
                    {article.birthplace?.trim() && article.birthplace !== 'غير محدد' && (
                      <tr>
                        <th>مكان الميلاد والنشأة</th>
                        <td>{article.birthplace}</td>
                      </tr>
                    )}
                    {article.clanAffiliation?.trim() && (
                      <tr>
                        <th>الانتماء العشائري</th>
                        <td>
                          <CitationText
                            text={article.clanAffiliation}
                            compact
                            existingTitles={existingTitles}
                            onWikiLinkClick={onWikiLinkClick}
                            resolveWikiLinkHref={resolveWikiLinkHref}
                          />
                        </td>
                      </tr>
                    )}
                    <tr>
                      <th>المجال / التخصص</th>
                      <td>{article.field}</td>
                    </tr>
                    {article.activeYears?.trim() && (
                      <tr>
                        <th>سنوات النشاط</th>
                        <td className="font-mono-tabular">{article.activeYears}</td>
                      </tr>
                    )}
                    {article.notableWorks?.trim() && (
                      <tr>
                        <th>أبرز الأعمال والمناصب</th>
                        <td>
                          <CitationText
                            text={article.notableWorks}
                            compact
                            existingTitles={existingTitles}
                            onWikiLinkClick={onWikiLinkClick}
                            resolveWikiLinkHref={resolveWikiLinkHref}
                          />
                        </td>
                      </tr>
                    )}
                    {extraPersonRows.map((row, idx) => (
                      <tr key={`extra-person-${idx}`}>
                        <th>{row.label}</th>
                        <td>
                          <CitationText
                            text={row.value}
                            compact
                            existingTitles={existingTitles}
                            onWikiLinkClick={onWikiLinkClick}
                            resolveWikiLinkHref={resolveWikiLinkHref}
                          />
                        </td>
                      </tr>
                    ))}
                  </>
                )}

                {articleType === 'place' && (
                  <>
                    <tr>
                      <th>نوع المقال</th>
                      <td>منطقة جغرافية</td>
                    </tr>
                    {article.subtitle && (
                      <tr>
                        <th>الصفة الجغرافية</th>
                        <td>{article.subtitle}</td>
                      </tr>
                    )}
                    {(article.geographicLocation?.trim() || article.birthplace?.trim()) && (
                      <tr>
                        <th>الموقع الجغرافي</th>
                        <td>{article.geographicLocation?.trim() || article.birthplace}</td>
                      </tr>
                    )}
                    {article.administrativeRegion?.trim() && (
                      <tr>
                        <th>المحافظة / الإقليم</th>
                        <td>{article.administrativeRegion}</td>
                      </tr>
                    )}
                    {article.coordinates?.trim() && (
                      <tr>
                        <th>الإحداثيات الجغرافية</th>
                        <td>
                          <span dir="ltr" className="font-mono-tabular inline-block">
                            {article.coordinates}
                          </span>
                        </td>
                      </tr>
                    )}
                    {article.populationEstimate?.trim() && (
                      <tr>
                        <th>التقدير السكاني</th>
                        <td>{article.populationEstimate}</td>
                      </tr>
                    )}
                    <tr>
                      <th>التصنيف الجغرافي</th>
                      <td>{article.field}</td>
                    </tr>
                    {article.activeYears?.trim() && (
                      <tr>
                        <th>الامتداد التاريخي</th>
                        <td className="font-mono-tabular">{article.activeYears}</td>
                      </tr>
                    )}
                    {article.notableWorks?.trim() && (
                      <tr>
                        <th>أبرز المعالم</th>
                        <td>
                          <CitationText
                            text={article.notableWorks}
                            compact
                            existingTitles={existingTitles}
                            onWikiLinkClick={onWikiLinkClick}
                            resolveWikiLinkHref={resolveWikiLinkHref}
                          />
                        </td>
                      </tr>
                    )}
                    {article.relatedClans?.trim() && (
                      <tr>
                        <th>العشائر والأعلام المرتبطة</th>
                        <td>
                          <CitationText
                            text={article.relatedClans}
                            compact
                            existingTitles={existingTitles}
                            onWikiLinkClick={onWikiLinkClick}
                            resolveWikiLinkHref={resolveWikiLinkHref}
                          />
                        </td>
                      </tr>
                    )}
                    {extraPlaceRows.map((row, idx) => (
                      <tr key={`extra-place-${idx}`}>
                        <th>{row.label}</th>
                        <td>
                          <CitationText
                            text={row.value}
                            compact
                            existingTitles={existingTitles}
                            onWikiLinkClick={onWikiLinkClick}
                            resolveWikiLinkHref={resolveWikiLinkHref}
                          />
                        </td>
                      </tr>
                    ))}
                  </>
                )}

                {articleType === 'general' &&
                  (article.infoboxRows && article.infoboxRows.length > 0 ? (
                    article.infoboxRows.map((row, idx) => (
                      <tr key={idx}>
                        <th>{row.label}</th>
                        <td>
                          <CitationText
                            text={row.value}
                            compact
                            existingTitles={existingTitles}
                            onWikiLinkClick={onWikiLinkClick}
                            resolveWikiLinkHref={resolveWikiLinkHref}
                          />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <>
                      <tr>
                        <th>الوصف / الصفة</th>
                        <td>{article.subtitle}</td>
                      </tr>
                      {article.historicalEra?.trim() && (
                        <tr>
                          <th>الحقبة التاريخية</th>
                          <td>{article.historicalEra}</td>
                        </tr>
                      )}
                      <tr>
                        <th>المجال</th>
                        <td>{article.field}</td>
                      </tr>
                      {article.activeYears?.trim() && (
                        <tr>
                          <th>سنوات الامتداد</th>
                          <td className="font-mono-tabular">{article.activeYears}</td>
                        </tr>
                      )}
                      {article.notableWorks?.trim() && (
                        <tr>
                          <th>أبرز المعالم / الأعمال</th>
                          <td>{article.notableWorks}</td>
                        </tr>
                      )}
                    </>
                  ))}
              </tbody>
            </table>
          </aside>

          {/* النص الموسوعي الرئيسي بتدرج خطوط وتباعد Vector 2022 */}
          <article className="main-article-body flex-1 min-w-0 max-w-[80ch] text-[#202122] space-y-6">
            <section id="sec-intro" className="scroll-mt-20">
              <CitationText
                text={article.summary}
                onCitationClick={handleCitationClick}
                existingTitles={existingTitles}
                onWikiLinkClick={onWikiLinkClick}
                resolveWikiLinkHref={resolveWikiLinkHref}
              />
            </section>

            {/* فهرس المحتويات التلقائي للمقالات الطويلة ذات الأقسام (Table of Contents — طراز ويكيبيديا) */}
            {toc.shouldShowInlineToc && (
              <nav
                aria-label="فهرس المحتويات"
                className="w-full sm:max-w-[440px] bg-[#f8f9fa] border border-[#a2a9b1] rounded-xs text-[13px]"
              >
                <div className="flex items-center justify-between gap-3 px-3.5 py-2 border-b border-[#eaecf0]">
                  <div className="flex items-center gap-2 text-[#202122] font-bold">
                    <List className="w-3.5 h-3.5 text-[#54595d]" aria-hidden="true" />
                    <span>فهرس المحتويات</span>
                    <span className="text-[11px] font-normal text-[#54595d] font-mono-tabular">
                      · {toc.items.length}{' '}
                      {toc.items.length === 1 ? 'قسم' : toc.items.length <= 10 ? 'أقسام' : 'قسماً'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTocCollapsed((prev) => !prev)}
                    aria-expanded={!isTocCollapsed}
                    className="text-[11px] text-[#3366cc] hover:underline font-medium cursor-pointer whitespace-nowrap shrink-0"
                  >
                    [{isTocCollapsed ? 'إظهار' : 'إخفاء'}]
                  </button>
                </div>

                {!isTocCollapsed && (
                  <ol className="px-3.5 py-2.5 space-y-1.5">
                    {toc.items.map((item) => {
                      const isActive = activeTocId === item.id;
                      return (
                        <li key={item.id} className="space-y-1">
                          <a
                            href={`#${item.id}`}
                            aria-current={isActive ? 'location' : undefined}
                            onClick={(e) => {
                              if (shouldHandleClientNavigation(e)) {
                                e.preventDefault();
                                handleJumpToSection(item.id);
                              }
                            }}
                            className={`flex items-baseline gap-2 py-0.5 rounded-xs transition-colors hover:underline ${
                              isActive
                                ? 'text-[#202122] font-bold'
                                : 'text-[#3366cc] hover:text-[#2a4b8d]'
                            }`}
                          >
                            <span className="font-mono-tabular text-[11px] text-[#54595d] shrink-0">
                              {item.number}
                            </span>
                            <span className="leading-snug">{item.title}</span>
                          </a>

                          {item.children.length > 0 && (
                            <ol className="pr-5 space-y-1">
                              {item.children.map((sub) => {
                                const isSubActive = activeTocId === sub.id;
                                return (
                                  <li
                                    key={sub.id}
                                    className={sub.level === 4 ? 'pr-4' : ''}
                                  >
                                    <a
                                      href={`#${sub.id}`}
                                      aria-current={isSubActive ? 'location' : undefined}
                                      onClick={(e) => {
                                        if (shouldHandleClientNavigation(e)) {
                                          e.preventDefault();
                                          handleJumpToSection(sub.id);
                                        }
                                      }}
                                      className={`flex items-baseline gap-2 py-0.5 text-[12px] rounded-xs transition-colors hover:underline ${
                                        isSubActive
                                          ? 'text-[#202122] font-bold'
                                          : 'text-[#3366cc] hover:text-[#2a4b8d]'
                                      }`}
                                    >
                                      <span className="font-mono-tabular text-[11px] text-[#54595d] shrink-0">
                                        {sub.number}
                                      </span>
                                      <span className="leading-snug">{sub.title}</span>
                                    </a>
                                  </li>
                                );
                              })}
                            </ol>
                          )}
                        </li>
                      );
                    })}

                    <li>
                      <a
                        href={`#${toc.referencesItem.id}`}
                        aria-current={
                          activeTocId === toc.referencesItem.id ? 'location' : undefined
                        }
                        onClick={(e) => {
                          if (shouldHandleClientNavigation(e)) {
                            e.preventDefault();
                            handleJumpToSection(toc.referencesItem.id);
                          }
                        }}
                        className={`flex items-baseline gap-2 py-0.5 rounded-xs transition-colors hover:underline ${
                          activeTocId === toc.referencesItem.id
                            ? 'text-[#202122] font-bold'
                            : 'text-[#3366cc] hover:text-[#2a4b8d]'
                        }`}
                      >
                        <span className="font-mono-tabular text-[11px] text-[#54595d] shrink-0">
                          {toc.referencesItem.number}
                        </span>
                        <span className="leading-snug">{toc.referencesItem.title}</span>
                      </a>
                    </li>
                  </ol>
                )}
              </nav>
            )}

            {article.sections.map((section, idx) => {
              const sectionAnchorId = toc.sectionAnchorByIndex[idx] ?? section.id;
              return (
                <section
                  key={`${sectionAnchorId}-${idx}`}
                  id={sectionAnchorId}
                  className="scroll-mt-24 pt-1 space-y-3"
                >
                  <div className="group flex items-baseline justify-between gap-2 border-b border-[#a2a9b1]/60 pb-1">
                    <h2 className="wiki-title text-[22px] sm:text-[25px] leading-[1.35] font-bold text-[#202122] flex items-baseline gap-2">
                      <span>{section.title}</span>
                      <a
                        href={`#${sectionAnchorId}`}
                        onClick={(e) => {
                          if (shouldHandleClientNavigation(e)) {
                            e.preventDefault();
                            handleJumpToSection(sectionAnchorId, true);
                          }
                        }}
                        aria-label={`نسخ الرابط المباشر لقسم ${section.title}`}
                        title="نسخ الرابط المباشر لهذا القسم"
                        className="text-sm font-mono-tabular font-normal text-[#a2a9b1] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[#3366cc] transition-opacity select-none"
                      >
                        #
                      </a>
                    </h2>
                    {copiedAnchorId === sectionAnchorId && (
                      <span className="text-[11px] text-[#14866d] font-medium shrink-0">
                        تم نسخ رابط القسم
                      </span>
                    )}
                  </div>
                  <CitationText
                    text={section.content}
                    onCitationClick={handleCitationClick}
                    existingTitles={existingTitles}
                    onWikiLinkClick={onWikiLinkClick}
                    resolveWikiLinkHref={resolveWikiLinkHref}
                    sectionAnchorId={sectionAnchorId}
                    onSubheadingAnchorClick={(subId) => handleJumpToSection(subId, true)}
                  />
                </section>
              );
            })}

            {/* قسم المراجع والمصادر بأسلوب ويكيبيديا الاحترافي (.reflist) */}
            <section id="sec-references" className="scroll-mt-24 pt-2 space-y-3.5">
              <div className="flex items-baseline justify-between border-b border-[#a2a9b1]/60 pb-1">
                <h2 className="wiki-title text-[22px] sm:text-[25px] leading-[1.35] font-bold text-[#202122]">
                  المراجع والمصادر
                </h2>
                {article.references.length > 0 && (
                  <span className="text-[11px] font-mono-tabular text-[#54595d]">
                    {article.references.length}{' '}
                    {article.references.length === 1 ? 'مصدر موثق' : 'مصادر موثقة'}
                  </span>
                )}
              </div>

              {article.references.length === 0 ? (
                <p className="text-xs text-[#54595d] py-2">
                  لا توجد مراجع مسجلة لهذه المقالة بعد.
                </p>
              ) : (
                <ol
                  className={`text-[13px] leading-[1.7] text-[#202122] space-y-2.5 ${
                    article.references.length >= 4 ? 'md:columns-2 md:gap-8' : ''
                  }`}
                >
                  {article.references.map((refItem) => (
                    <li
                      key={refItem.id}
                      id={`ref-${refItem.id}`}
                      className={`break-inside-avoid scroll-mt-24 flex items-start gap-2 px-2.5 py-1.5 rounded-xs transition-colors ${
                        highlightedRef === refItem.id
                          ? 'bg-[#eaf3ff] border-r-2 border-[#3366cc]'
                          : 'hover:bg-[#f8f9fa]'
                      }`}
                    >
                      <span className="font-mono-tabular text-[11px] font-semibold text-[#3366cc] shrink-0 mt-0.5 select-none">
                        [{refItem.id}]
                      </span>
                      <span className="flex-1 text-[#202122]">{renderReferenceText(refItem.text)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* شريط التصنيفات الرئيسية والفرعية أسفل المقالة (Wikipedia catlinks — روابط قابلة للفهرسة) */}
            <div className="mt-8 px-3.5 py-2.5 bg-[#f8f9fa] border border-[#a2a9b1] rounded-xs text-xs space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-[#202122]">التصنيفات الرئيسية:</span>
                {article.categories.map((cat, idx) => (
                  <React.Fragment key={cat}>
                    <a
                      href={getCategoryPath(cat)}
                      onClick={(e) => {
                        if (shouldHandleClientNavigation(e)) {
                          e.preventDefault();
                          onSelectCategory(cat);
                        }
                      }}
                      className="text-[#3366cc] hover:underline"
                    >
                      {cat}
                    </a>
                    {idx < article.categories.length - 1 && (
                      <span className="text-[#a2a9b1]" aria-hidden="true">
                        |
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {effectiveSubcategories.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-t border-[#eaecf0] pt-2">
                  <span className="font-bold text-[#14866d]">التصنيفات الفرعية:</span>
                  {effectiveSubcategories.map((sub, idx) => (
                    <React.Fragment key={sub}>
                      <a
                        href={getSubcategoryPath(sub)}
                        onClick={(e) => {
                          if (onSelectSubcategory && shouldHandleClientNavigation(e)) {
                            e.preventDefault();
                            onSelectSubcategory(sub);
                          }
                        }}
                        className="text-[#14866d] hover:underline"
                      >
                        {sub}
                      </a>
                      {idx < effectiveSubcategories.length - 1 && (
                        <span className="text-[#a2a9b1]" aria-hidden="true">
                          |
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </article>
          </div>
        </div>
      )}

      {/* 2. تبويب اقتراح التعديل */}
      {activeTab === 'edit' && (
        <ProposeEditForm
          article={article}
          isAdminSession={isAdminSession}
          isSignedIn={isSignedIn}
          userDisplayName={userDisplayName}
          onSignIn={onSignIn}
          settings={settings}
          activeMemberName={activeMemberName}
          onSubmit={onSubmitEditProposal}
          onCancel={() => onTabChange('read')}
        />
      )}

      {/* 3. تبويب تاريخ المراجعات */}
      {activeTab === 'history' && (
        <HistoryAndPendingTab
          article={article}
          pendingForArticle={pendingForArticle}
          isAdminSession={isAdminSession}
          activeMemberName={activeMemberName}
          onApproveRevision={onApproveRevision}
          onRejectRevision={onRejectRevision}
        />
      )}

      {/* 4. تبويب النقاش */}
      {activeTab === 'talk' && (
        <TalkTab
          article={article}
          isAdminSession={isAdminSession}
          isSignedIn={isSignedIn}
          userDisplayName={userDisplayName}
          onSignIn={onSignIn}
          activeMemberName={activeMemberName}
          onAddMessage={(author, topic, text) =>
            onAddTalkMessage({ articleId: article.id, author, topic, text })
          }
        />
      )}

      {/* 5. تبويب تحكم الصفحة المستقلة (متاح فقط داخل لوحة التحكم والمشرفين) */}
      {activeTab === 'control' && showPageControlTab && isAdminSession && (
        <PageControlTab
          article={article}
          members={members}
          isAdminSession={isAdminSession}
          settings={settings}
          canDeleteArticle={canDeleteArticle}
          onSaveControls={(payload) =>
            onUpdatePageControls({ articleId: article.id, ...payload })
          }
          onDeleteArticle={() => onDeleteArticle(article.id)}
        />
      )}
    </div>
  );
}

/* ---------------- نموذج اقتراح التعديل ---------------- */

function ProposeEditForm({
  article,
  isAdminSession,
  isSignedIn = true,
  userDisplayName,
  onSignIn,
  settings,
  activeMemberName,
  onSubmit,
  onCancel
}: {
  article: Article;
  isAdminSession: boolean;
  isSignedIn?: boolean;
  userDisplayName?: string | null;
  onSignIn?: () => void;
  settings: SystemSettings;
  activeMemberName: string;
  onSubmit: (payload: {
    articleId: string;
    proposedData: ArticleSnapshot;
    author: string;
    summary: string;
    publishDirectly: boolean;
  }) => void;
  onCancel: () => void;
}) {
  const initialType = inferArticleType(article);

  const [articleType, setArticleType] = useState<ArticleType>(initialType);
  const [name, setName] = useState(article.name);
  const [subtitle, setSubtitle] = useState(article.subtitle);
  const [portal, setPortal] = useState<WikiPortal>(article.portal);
  const [field, setField] = useState(article.field);
  const [activeYears, setActiveYears] = useState(article.activeYears);
  const [notableWorks, setNotableWorks] = useState(article.notableWorks);

  // حقول خاصة بنوع «شخصية» فقط
  const [birthDate, setBirthDate] = useState(() => {
    if (article.birthDate?.trim()) return article.birthDate.trim();
    if (initialType === 'person' && article.birthDeath?.trim()) {
      const parts = article.birthDeath.split(/[–-]/);
      return parts[0]?.replace(/^مواليد\s*/, '').trim() ?? '';
    }
    return '';
  });
  const [deathDate, setDeathDate] = useState(() => {
    if (article.deathDate?.trim()) return article.deathDate.trim();
    if (initialType === 'person' && article.birthDeath?.trim()) {
      const parts = article.birthDeath.split(/[–-]/);
      return parts.length > 1 ? parts.slice(1).join('–').trim() : '';
    }
    return '';
  });
  const [birthplace, setBirthplace] = useState(
    initialType === 'person' ? article.birthplace : ''
  );
  const [clanAffiliation, setClanAffiliation] = useState(article.clanAffiliation ?? '');

  // حقول خاصة بنوع «منطقة» فقط
  const [geographicLocation, setGeographicLocation] = useState(
    article.geographicLocation?.trim() ||
      (initialType === 'place' ? article.birthplace : '')
  );
  const [administrativeRegion, setAdministrativeRegion] = useState(
    article.administrativeRegion ?? ''
  );
  const [coordinates, setCoordinates] = useState(article.coordinates ?? '');
  const [populationEstimate, setPopulationEstimate] = useState(
    article.populationEstimate ?? ''
  );
  const [relatedClans, setRelatedClans] = useState(article.relatedClans ?? '');

  // حقل خاص بنوع «موضوع عام / عشيرة / حدث» فقط
  const [historicalEra, setHistoricalEra] = useState(article.historicalEra ?? '');

  const [imageUrl, setImageUrl] = useState(article.imageUrl ?? '');
  const [imageCaption, setImageCaption] = useState(article.imageCaption ?? '');
  const [categoriesText, setCategoriesText] = useState(article.categories.join('، '));
  const [subcategoriesText, setSubcategoriesText] = useState(() =>
    getEffectiveSubcategories(article).join('، ')
  );
  const [isStubFlag, setIsStubFlag] = useState<boolean>(
    () => evaluateArticleStubStatus(article).isStub
  );
  const [summary, setSummary] = useState(article.summary);
  const [sections, setSections] = useState<ArticleSection[]>(() =>
    article.sections.map((s) => ({ ...s }))
  );
  const [references, setReferences] = useState<ArticleReference[]>(() =>
    article.references.map((r) => ({ ...r }))
  );
  const [author, setAuthor] = useState(() => (!isAdminSession && userDisplayName ? userDisplayName : ''));
  const [editSummary, setEditSummary] = useState('');
  const [publishDirectly, setPublishDirectly] = useState(isAdminSession);
  const [error, setError] = useState('');
  const [imgStatus, setImgStatus] = useState<ImageLoadStatus>('idle');

  useEffect(() => {
    setPublishDirectly(isAdminSession);
  }, [isAdminSession]);

  const imageValidation = useMemo(() => validateImageUrl(imageUrl), [imageUrl]);
  const safeImgPreview = settings.allowImageUrls
    ? imageValidation.sanitized
    : sanitizeImageUrl(article.imageUrl);

  useEffect(() => {
    if (!safeImgPreview) {
      setImgStatus('idle');
    }
  }, [safeImgPreview]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignedIn) {
      setError('يرجى تسجيل الدخول عبر Google أولاً لإرسال مقترح التعديل.');
      return;
    }
    if (name.trim().length < 2 || field.trim().length < 2 || summary.trim().length < 5) {
      setError('الحقول الأساسية مطلوبة (العنوان والمجال بحرفين على الأقل، والمقدمة بخمسة أحرف على الأقل).');
      return;
    }
    if (settings.allowImageUrls && !imageValidation.valid) {
      setError(
        imageValidation.error ??
          'رابط الصورة غير صالح. يرجى التأكد من بدايته بـ https:// أو http://.'
      );
      return;
    }
    if (editSummary.trim().length < 2) {
      setError('يرجى كتابة ملخص التعديل وسبب الإضافة (حرفان على الأقل).');
      return;
    }

    const cleanedCats = categoriesText
      .split(/[،,]/)
      .map((c) => c.trim())
      .filter(Boolean);

    const cleanedSubcats = Array.from(
      new Set(
        subcategoriesText
          .split(/[،,]/)
          .map((s) => s.trim())
          .filter(Boolean)
      )
    ).slice(0, 20);

    const cleanedSections = sections
      .filter((s) => s.title.trim() || s.content.trim())
      .map((s, idx) => ({
        id: s.id || `sec-${Date.now()}-${idx}`,
        title: s.title.trim() || `قسم ${idx + 1}`,
        content: s.content.trim()
      }));

    const cleanedRefs = references
      .filter((r) => r.text.trim())
      .map((r, idx) => ({ id: idx + 1, text: r.text.trim() }));

    const shouldPublishDirectly =
      isAdminSession && (publishDirectly || !settings.requireMemberApproval);

    const computedBirthDeath =
      articleType === 'person'
        ? formatPersonLifespan({ birthDate: birthDate.trim(), deathDate: deathDate.trim() })
        : '';

    const computedBirthplace =
      articleType === 'person'
        ? birthplace.trim()
        : articleType === 'place'
          ? getPlaceLocationSummary({
              geographicLocation: geographicLocation.trim(),
              administrativeRegion: administrativeRegion.trim()
            })
          : '';

    onSubmit({
      articleId: article.id,
      author:
        author.trim() ||
        (isAdminSession ? activeMemberName : userDisplayName || 'باحث مساهم'),
      summary: editSummary.trim(),
      publishDirectly: shouldPublishDirectly,
      proposedData: {
        name: name.trim(),
        subtitle: subtitle.trim(),
        portal,
        articleType,
        field: field.trim(),
        activeYears: activeYears.trim(),
        birthDate: articleType === 'person' ? birthDate.trim() : '',
        deathDate: articleType === 'person' ? deathDate.trim() : '',
        birthDeath: computedBirthDeath,
        birthplace: computedBirthplace,
        clanAffiliation: articleType === 'person' ? clanAffiliation.trim() : '',
        geographicLocation: articleType === 'place' ? geographicLocation.trim() : '',
        administrativeRegion: articleType === 'place' ? administrativeRegion.trim() : '',
        coordinates: articleType === 'place' ? coordinates.trim() : '',
        populationEstimate: articleType === 'place' ? populationEstimate.trim() : '',
        relatedClans: articleType === 'place' ? relatedClans.trim() : '',
        historicalEra: articleType === 'general' ? historicalEra.trim() : '',
        notableWorks: notableWorks.trim(),
        ...(articleType === 'general' && article.infoboxRows
          ? { infoboxRows: article.infoboxRows }
          : {}),
        imageUrl: safeImgPreview,
        imageCaption: imageCaption.trim(),
        categories: cleanedCats.length > 0 ? cleanedCats : [field.trim()],
        subcategories: cleanedSubcats,
        isStub: isStubFlag,
        ...(typeof article.needsSources === 'boolean'
          ? { needsSources: article.needsSources }
          : {}),
        ...(typeof article.isFeatured === 'boolean' ? { isFeatured: article.isFeatured } : {}),
        summary: summary.trim(),
        sections: cleanedSections,
        references: cleanedRefs
      }
    });
  };

  const selectedEditSubcats = subcategoriesText
    .split(/[،,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const toggleEditSubcategory = (sub: string) => {
    const exists = selectedEditSubcats.includes(sub);
    const next = exists
      ? selectedEditSubcats.filter((item) => item !== sub)
      : [...selectedEditSubcats, sub];
    setSubcategoriesText(next.join('، '));
  };

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border-r-4 border-[#3366cc] p-4 text-xs text-[#202122]">
        <div className="font-bold text-sm text-[#3366cc] mb-1 flex items-center gap-1.5">
          <Info className="w-4 h-4" aria-hidden="true" />
          <span>آلية المساهمة تحت إشراف الأعضاء المعتمدين</span>
        </div>
        <p className="leading-relaxed">
          للحفاظ على الأمانة التوثيقية في ويكي فيلي، تُرسل التعديلات إلى قائمة المراجعة ليؤكد{' '}
          <strong>الأعضاء المشرفون</strong> الموافقة عليها بعد فحص الفروقات النصية والمصادر.
        </p>
      </div>

      {!isSignedIn && onSignIn && (
        <div className="bg-amber-50 border border-amber-300 rounded p-3.5 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="text-amber-950">
            <strong>مطلوب تسجيل الدخول للمساهمة:</strong> لتوثيق المساهمات وحفظها في قاعدة البيانات، يرجى تسجيل الدخول بحساب Google الموثق أولاً.
          </div>
          <button
            type="button"
            onClick={onSignIn}
            className="px-3.5 py-1.5 bg-[#3366cc] hover:bg-[#2a4b8d] text-white font-bold rounded cursor-pointer shrink-0"
          >
            تسجيل الدخول عبر Google
          </button>
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="space-y-5 text-xs">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-[#d33] rounded">
            {error}
          </div>
        )}

        <div className="border border-[#eaecf0] rounded-md p-4 bg-[#f8f9fa] space-y-4">
          <h3 className="font-bold text-sm text-[#202122] border-b border-[#eaecf0] pb-2">
            1. نوع المقال وبيانات صندوق المعلومات والبوابة والصورة
          </h3>

          {/* اختيار نوع المقال لتبديل الحقول المخصصة ديناميكياً */}
          <div className="space-y-1.5">
            <span className="block font-semibold text-[#202122]">
              نوع المقال (يحدد الحقول المخصصة في النموذج وبطاقة البيانات)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {ARTICLE_TYPE_OPTIONS.map((opt) => {
                const selected = articleType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setArticleType(opt.id)}
                    className={`p-2.5 rounded border text-right transition cursor-pointer ${
                      selected
                        ? 'bg-[#eaf3ff] border-[#3366cc] ring-1 ring-[#3366cc] text-[#202122]'
                        : 'bg-white border-[#a2a9b1] hover:bg-gray-50 text-[#54595d]'
                    }`}
                  >
                    <div className="font-bold text-xs text-[#202122] flex items-center justify-between gap-1">
                      <span>{opt.label}</span>
                      {selected && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#3366cc] shrink-0" />
                      )}
                    </div>
                    <div className="text-[10.5px] text-[#54595d] mt-0.5 line-clamp-1">
                      {opt.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label htmlFor="edit-name" className="block font-semibold mb-1">
                {articleType === 'person'
                  ? 'الاسم الكامل للشخصية *'
                  : articleType === 'place'
                    ? 'اسم المنطقة أو المدينة *'
                    : 'العنوان / الاسم *'}
              </label>
              <input
                id="edit-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:border-[#3366cc] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="edit-portal" className="block font-semibold mb-1">
                البوابة *
              </label>
              <select
                id="edit-portal"
                value={portal}
                onChange={(e) => setPortal(e.target.value as WikiPortal)}
                className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:border-[#3366cc] focus:outline-none"
              >
                {WIKI_PORTALS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.shortLabel}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="edit-subtitle" className="block font-semibold mb-1">
                {articleType === 'person'
                  ? 'الصفة / اللقب العلمي أو المهني'
                  : articleType === 'place'
                    ? 'الصفة الجغرافية'
                    : 'الوصف / اللقب'}
              </label>
              <input
                id="edit-subtitle"
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:border-[#3366cc] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="edit-field" className="block font-semibold mb-1">
                {articleType === 'place' ? 'التصنيف الجغرافي *' : 'المجال *'}
              </label>
              <input
                id="edit-field"
                type="text"
                value={field}
                onChange={(e) => setField(e.target.value)}
                className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:border-[#3366cc] focus:outline-none"
              />
            </div>

            {/* حقول خاصة بالمقالات من نوع «شخصية» فقط */}
            {articleType === 'person' && (
              <>
                <div>
                  <label htmlFor="edit-birthDate" className="block font-semibold mb-1">
                    تاريخ الميلاد
                  </label>
                  <input
                    id="edit-birthDate"
                    type="text"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    placeholder="مثال: 1938"
                    className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:border-[#3366cc] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="edit-deathDate" className="block font-semibold mb-1">
                    تاريخ الوفاة (اختياري)
                  </label>
                  <input
                    id="edit-deathDate"
                    type="text"
                    value={deathDate}
                    onChange={(e) => setDeathDate(e.target.value)}
                    placeholder="اتركه فارغاً للأحياء"
                    className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:border-[#3366cc] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="edit-birthplace" className="block font-semibold mb-1">
                    مكان الميلاد والنشأة
                  </label>
                  <input
                    id="edit-birthplace"
                    type="text"
                    value={birthplace}
                    onChange={(e) => setBirthplace(e.target.value)}
                    className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:border-[#3366cc] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="edit-clanAffiliation" className="block font-semibold mb-1">
                    الانتماء العشائري / العائلي
                  </label>
                  <input
                    id="edit-clanAffiliation"
                    type="text"
                    value={clanAffiliation}
                    onChange={(e) => setClanAffiliation(e.target.value)}
                    placeholder="مثال: عشيرة الأركوازي / الزنكنة"
                    className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:border-[#3366cc] focus:outline-none"
                  />
                </div>
              </>
            )}

            {/* حقول خاصة بالمقالات من نوع «منطقة» فقط */}
            {articleType === 'place' && (
              <>
                <div>
                  <label htmlFor="edit-geographicLocation" className="block font-semibold mb-1">
                    الموقع الجغرافي
                  </label>
                  <input
                    id="edit-geographicLocation"
                    type="text"
                    value={geographicLocation}
                    onChange={(e) => setGeographicLocation(e.target.value)}
                    placeholder="مثال: شرق العراق على ضفاف نهر الوند"
                    className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:border-[#3366cc] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="edit-administrativeRegion" className="block font-semibold mb-1">
                    المحافظة / الإقليم / الدولة
                  </label>
                  <input
                    id="edit-administrativeRegion"
                    type="text"
                    value={administrativeRegion}
                    onChange={(e) => setAdministrativeRegion(e.target.value)}
                    placeholder="مثال: محافظة ديالى، العراق"
                    className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:border-[#3366cc] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="edit-coordinates" className="block font-semibold mb-1">
                    الإحداثيات الجغرافية
                  </label>
                  <input
                    id="edit-coordinates"
                    type="text"
                    dir="ltr"
                    value={coordinates}
                    onChange={(e) => setCoordinates(e.target.value)}
                    placeholder="34.3483° N, 45.3906° E"
                    className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:border-[#3366cc] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="edit-populationEstimate" className="block font-semibold mb-1">
                    التقدير السكاني
                  </label>
                  <input
                    id="edit-populationEstimate"
                    type="text"
                    value={populationEstimate}
                    onChange={(e) => setPopulationEstimate(e.target.value)}
                    className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:border-[#3366cc] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="edit-relatedClans" className="block font-semibold mb-1">
                    العشائر والأعلام المرتبطة
                  </label>
                  <input
                    id="edit-relatedClans"
                    type="text"
                    value={relatedClans}
                    onChange={(e) => setRelatedClans(e.target.value)}
                    className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:border-[#3366cc] focus:outline-none"
                  />
                </div>
              </>
            )}

            {/* حقل خاص بالموضوعات العامة والعشائر والأحداث */}
            {articleType === 'general' && (
              <div>
                <label htmlFor="edit-historicalEra" className="block font-semibold mb-1">
                  الحقبة التاريخية / العمق الزمني
                </label>
                <input
                  id="edit-historicalEra"
                  type="text"
                  value={historicalEra}
                  onChange={(e) => setHistoricalEra(e.target.value)}
                  className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:border-[#3366cc] focus:outline-none"
                />
              </div>
            )}

            <div>
              <label htmlFor="edit-activeYears" className="block font-semibold mb-1">
                {articleType === 'person'
                  ? 'سنوات النشاط'
                  : articleType === 'place'
                    ? 'الامتداد التاريخي'
                    : 'سنوات الامتداد'}
              </label>
              <input
                id="edit-activeYears"
                type="text"
                value={activeYears}
                onChange={(e) => setActiveYears(e.target.value)}
                className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:border-[#3366cc] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="edit-works" className="block font-semibold mb-1">
                {articleType === 'person'
                  ? 'أبرز الأعمال والمناصب'
                  : articleType === 'place'
                    ? 'أبرز المعالم'
                    : 'أبرز المعالم أو الأعمال'}
              </label>
              <input
                id="edit-works"
                type="text"
                value={notableWorks}
                onChange={(e) => setNotableWorks(e.target.value)}
                className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:border-[#3366cc] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="edit-cats" className="block font-semibold mb-1">
                التصنيفات الرئيسية (مفصولة بفاصلة)
              </label>
              <input
                id="edit-cats"
                type="text"
                value={categoriesText}
                onChange={(e) => setCategoriesText(e.target.value)}
                className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:border-[#3366cc] focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 space-y-2">
              <label htmlFor="edit-subcats" className="block font-semibold">
                التصنيفات الفرعية (مفصولة بفاصلة — لتنظيم الفهرس الدقيق)
              </label>
              <input
                id="edit-subcats"
                type="text"
                value={subcategoriesText}
                onChange={(e) => setSubcategoriesText(e.target.value)}
                placeholder="مثال: شعراء وأدباء، أعلام خانقين، فروع عشيرة الأركوازي..."
                className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:border-[#14866d] focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[#54595d]">
                  اقتراحات بوابة {portal}:
                </span>
                {PORTAL_SUBCATEGORY_SUGGESTIONS[portal].map((sub) => {
                  const active = selectedEditSubcats.includes(sub);
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => toggleEditSubcategory(sub)}
                      className={`px-2 py-0.5 text-[11px] rounded border transition cursor-pointer ${
                        active
                          ? 'bg-[#e8f5f1] text-[#14866d] border-[#14866d] font-bold'
                          : 'bg-white text-[#54595d] border-[#c8ccd1] hover:border-[#14866d] hover:text-[#14866d]'
                      }`}
                    >
                      {active ? '✓ ' : '+ '}
                      {sub}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {settings.allowImageUrls && (
            <div className="pt-3 border-t border-[#eaecf0] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <div>
                  <label htmlFor="edit-imageUrl" className="block font-semibold mb-1">
                    رابط الصورة الشخصية (Image URL)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="edit-imageUrl"
                      type="text"
                      inputMode="url"
                      dir="ltr"
                      value={imageUrl}
                      onChange={(e) => {
                        setImageUrl(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="https://example.com/photo.jpg أو رابط Google Drive / Wikimedia"
                      className={`flex-1 p-2 bg-white border rounded focus:outline-none ${
                        imageUrl.trim() && !imageValidation.valid
                          ? 'border-[#d33] focus:border-[#d33]'
                          : 'border-[#a2a9b1] focus:border-[#3366cc]'
                      }`}
                    />
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="px-2.5 py-2 bg-white hover:bg-gray-100 text-[#54595d] border border-[#a2a9b1] rounded cursor-pointer shrink-0"
                        title="إزالة رابط الصورة"
                      >
                        مسح
                      </button>
                    )}
                  </div>
                  {imageUrl.trim() && !imageValidation.valid && (
                    <p className="text-[11px] text-[#d33] mt-1">
                      {imageValidation.error}
                    </p>
                  )}
                  {imageValidation.valid && imageValidation.transformedNote && (
                    <p className="text-[11px] text-[#3366cc] mt-1">
                      {imageValidation.transformedNote}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="edit-imageCaption" className="block font-semibold mb-1">
                    وصف / تعليق الصورة
                  </label>
                  <input
                    id="edit-imageCaption"
                    type="text"
                    value={imageCaption}
                    onChange={(e) => setImageCaption(e.target.value)}
                    placeholder="تعليق يظهر أسفل الصورة في صندوق المعلومات"
                    className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:border-[#3366cc] focus:outline-none"
                  />
                </div>
              </div>

              {safeImgPreview && (
                <div className="flex items-center gap-3 bg-white border border-[#eaecf0] p-2.5 rounded">
                  <div className="w-16 h-16 rounded border border-[#a2a9b1] bg-[#f8f9fa] overflow-hidden flex items-center justify-center shrink-0">
                    <SmartExternalImage
                      imageUrl={safeImgPreview}
                      alt="معاينة الصورة"
                      onStatusChange={setImgStatus}
                      className="w-full h-full object-cover block"
                      fallback={
                        <ImageIcon className="w-6 h-6 text-[#a2a9b1]" aria-hidden="true" />
                      }
                    />
                  </div>
                  <div className="space-y-1 min-w-0">
                    {imgStatus === 'loaded' && (
                      <span className="text-[11px] text-[#14866d] font-medium block">
                        تم تحميل الصورة بنجاح وهي جاهزة للعرض في المقال.
                      </span>
                    )}
                    {imgStatus === 'loading' && (
                      <span className="text-[11px] text-[#54595d] font-medium block">
                        جارٍ اختبار وتحميل معاينة الصورة من الرابط...
                      </span>
                    )}
                    {imgStatus === 'error' && (
                      <span className="text-[11px] text-[#ac6600] font-medium block leading-relaxed">
                        تعذر عرض الصورة من هذا الرابط (قد يكون رابط صفحة ويب وليس رابط صورة مباشر، أو أن الموقع يمنع العرض الخارجي). انقر بالزر الأيمن على الصورة واختر «نسخ عنوان الصورة»، أو تأكد في Google Drive أن المشاركة متاحة لأي شخص لديه الرابط.
                      </span>
                    )}
                    <div
                      className="text-[10px] text-[#54595d] font-mono-tabular truncate"
                      dir="ltr"
                    >
                      {safeImgPreview}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* نص المقالة */}
        <div className="border border-[#eaecf0] rounded-md p-4 bg-white space-y-4">
          <h3 className="font-bold text-sm text-[#202122] border-b border-[#eaecf0] pb-2">
            2. نص المقالة والأقسام
          </h3>

          <div>
            <label htmlFor="edit-summary" className="block font-bold mb-1">
              المقدمة التعريفية *
            </label>
            <textarea
              id="edit-summary"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full p-2.5 text-sm border border-[#a2a9b1] rounded focus:border-[#3366cc] focus:outline-none leading-relaxed"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold">الأقسام</span>
              <button
                type="button"
                onClick={() =>
                  setSections([
                    ...sections,
                    { id: `sec-${Date.now()}`, title: 'قسم جديد', content: '' }
                  ])
                }
                className="inline-flex items-center gap-1 text-[#3366cc] hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة قسم</span>
              </button>
            </div>
            {sections.map((sec, idx) => (
              <div key={sec.id} className="bg-[#f8f9fa] border border-[#eaecf0] rounded p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={sec.title}
                    onChange={(e) => {
                      const next = [...sections];
                      next[idx] = { ...next[idx], title: e.target.value };
                      setSections(next);
                    }}
                    className="flex-1 p-1.5 bg-white border border-[#a2a9b1] rounded font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setSections(sections.filter((_, i) => i !== idx))}
                    className="p-1 text-[#54595d] hover:text-[#d33] cursor-pointer"
                    aria-label="حذف القسم"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={sec.content}
                  onChange={(e) => {
                    const next = [...sections];
                    next[idx] = { ...next[idx], content: e.target.value };
                    setSections(next);
                  }}
                  className="w-full p-2 text-sm bg-white border border-[#a2a9b1] rounded leading-relaxed"
                />
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-2 border-t border-[#eaecf0]">
            <div className="flex items-center justify-between">
              <span className="font-bold">المراجع والمصادر</span>
              <button
                type="button"
                onClick={() =>
                  setReferences([...references, { id: references.length + 1, text: '' }])
                }
                className="inline-flex items-center gap-1 text-[#3366cc] hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة مرجع</span>
              </button>
            </div>
            {references.map((refItem, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="font-mono-tabular text-[#54595d] w-7">[{idx + 1}]</span>
                <input
                  type="text"
                  value={refItem.text}
                  onChange={(e) => {
                    const next = [...references];
                    next[idx] = { id: idx + 1, text: e.target.value };
                    setReferences(next);
                  }}
                  className="flex-1 p-1.5 border border-[#a2a9b1] rounded"
                />
                <button
                  type="button"
                  onClick={() => setReferences(references.filter((_, i) => i !== idx))}
                  className="p-1 text-[#54595d] hover:text-[#d33] cursor-pointer"
                  aria-label="حذف المرجع"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* توثيق المساهمة */}
        <div className="border border-[#a2a9b1] rounded-md p-4 bg-[#f8f9fa] space-y-4">
          <h3 className="font-bold text-sm text-[#202122] border-b border-[#eaecf0] pb-2">
            3. توثيق المساهمة وإرسالها للمراجعة
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-author" className="block font-bold mb-1">
                اسم المساهم / الباحث
              </label>
              <input
                id="edit-author"
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder={isAdminSession ? activeMemberName : 'مثال: د. سامان الفيلي'}
                className="w-full p-2 bg-white border border-[#a2a9b1] rounded"
              />
            </div>
            <div>
              <label htmlFor="edit-reason" className="block font-bold mb-1">
                ملخص التعديل وسبب الإضافة *
              </label>
              <input
                id="edit-reason"
                type="text"
                required
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                placeholder="مثال: إضافة مصدر تاريخي وتحديث البيانات"
                className="w-full p-2 bg-white border border-[#a2a9b1] rounded"
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-xs text-[#613900] bg-[#fef9e7] border border-[#e2c98d] p-3 rounded cursor-pointer">
            <input
              type="checkbox"
              checked={isStubFlag}
              onChange={(e) => setIsStubFlag(e.target.checked)}
              className="mt-0.5 rounded border-[#c7a75b] text-[#ac6600]"
            />
            <span>
              <strong className="inline-flex items-center gap-1">
                <Sprout className="w-3.5 h-3.5 text-[#ac6600]" aria-hidden="true" />
                <span>وسم هذه المقالة كـ «بذرة» (مقالة قصيرة غير مكتملة)</span>
              </strong>
              <span className="block text-[11px] text-[#7a4b00] mt-0.5">
                أبقِ هذا الخيار مفعّلاً إذا كانت المقالة لا تزال بحاجة لمزيد من الإثراء، أو أزل التحديد إذا أصبحت المقالة مكتملة وشاملة.
              </span>
            </span>
          </label>

          {isAdminSession && (
            <label className="inline-flex items-center gap-2 text-xs text-[#202122] cursor-pointer">
              <input
                type="checkbox"
                checked={publishDirectly}
                onChange={(e) => setPublishDirectly(e.target.checked)}
                className="rounded border-[#a2a9b1] text-[#14866d]"
              />
              <span>اعتماد ونشر مباشرة بتوقيعي ({activeMemberName}) دون قائمة الانتظار</span>
            </label>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={!isSignedIn}
              className="px-5 py-2 bg-[#3366cc] hover:bg-[#2a4b8d] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded inline-flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>
                {isAdminSession && (publishDirectly || !settings.requireMemberApproval)
                  ? 'نشر التعديل مباشرة'
                  : 'إرسال المساهمة لموافقة الأعضاء'}
              </span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-white hover:bg-gray-100 text-[#202122] border border-[#a2a9b1] text-sm rounded cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ---------------- تبويب تاريخ المراجعات ---------------- */

function HistoryAndPendingTab({
  article,
  pendingForArticle,
  isAdminSession,
  activeMemberName,
  onApproveRevision,
  onRejectRevision
}: {
  article: Article;
  pendingForArticle: PendingRevision[];
  isAdminSession: boolean;
  activeMemberName: string;
  onApproveRevision: (revisionId: string) => void;
  onRejectRevision: (revisionId: string, reason: string) => void;
}) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const reversedHistory = useMemo(() => [...article.history].reverse(), [article.history]);

  return (
    <div className="space-y-8">
      <div className="border border-amber-300 rounded-md overflow-hidden bg-white">
        <div className="bg-amber-50 px-4 py-3 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-sm text-amber-950">
            المساهمات المعلقة على هذه الصفحة (تحت إشراف الأعضاء)
          </h3>
          {!isAdminSession && (
            <span className="text-[11px] text-amber-900">
              تتم المراجعة والاعتماد من قبل هيئة الإشراف
            </span>
          )}
        </div>

        {pendingForArticle.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#54595d]">
            لا توجد مساهمات معلقة حالياً على هذه الصفحة.
          </div>
        ) : (
          <div className="divide-y divide-[#eaecf0]">
            {pendingForArticle.map((rev) => {
              const diffs = buildDiffComparison(rev.originalData, rev.proposedData).filter(
                (d) => d.hasChanges
              );
              return (
                <div key={rev.id} className="p-4 space-y-3 bg-amber-50/20">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-bold rounded border border-amber-300">
                        مقترح مساهمة
                      </span>
                      <span className="font-bold text-[#202122]">{rev.author}</span>
                      <span className="font-mono-tabular text-[#54595d]">({rev.submittedAt})</span>
                    </div>
                    <div className="text-[#202122] bg-[#f8f9fa] px-2.5 py-1 rounded border border-[#eaecf0]">
                      <strong>الملخص:</strong> {rev.summary}
                    </div>
                  </div>

                  {sanitizeImageUrl(rev.proposedData.imageUrl) && (
                    <div className="bg-white border border-[#eaecf0] rounded p-2.5 flex items-center gap-3 text-xs">
                      <div className="w-14 h-14 rounded border border-[#a2a9b1] bg-[#f8f9fa] overflow-hidden flex items-center justify-center shrink-0">
                        <SmartExternalImage
                          imageUrl={rev.proposedData.imageUrl}
                          alt="معاينة الصورة المقترحة"
                          className="w-full h-full object-cover block"
                          fallback={
                            <ImageIcon className="w-5 h-5 text-[#a2a9b1]" aria-hidden="true" />
                          }
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[#202122]">الصورة المقترحة عبر الرابط:</div>
                        <div className="text-[#54595d] truncate font-mono-tabular" dir="ltr">
                          {sanitizeImageUrl(rev.proposedData.imageUrl)}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-white border border-[#a2a9b1] rounded p-3 text-xs space-y-3">
                    {diffs.map((d) => (
                      <div key={d.key} className="space-y-1">
                        <div className="font-bold text-[#3366cc]">{d.label}</div>
                        <div className="bg-[#f8f9fa] p-2.5 rounded border border-[#eaecf0] whitespace-pre-wrap leading-relaxed">
                          {d.tokens.map((tok, i) =>
                            tok.type === 'added' ? (
                              <ins key={i} className="diff-ins">
                                {tok.text}
                              </ins>
                            ) : tok.type === 'removed' ? (
                              <del key={i} className="diff-del">
                                {tok.text}
                              </del>
                            ) : (
                              <span key={i}>{tok.text}</span>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {isAdminSession ? (
                    <div className="space-y-3 pt-2 border-t border-[#eaecf0]">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onApproveRevision(rev.id)}
                          className="px-3.5 py-1.5 bg-[#14866d] hover:bg-emerald-800 text-white font-bold text-xs rounded flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>تأكيد الموافقة والنشر باسم ({activeMemberName})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingId(rejectingId === rev.id ? null : rev.id);
                            setReasonError('');
                          }}
                          className="px-3.5 py-1.5 bg-white hover:bg-red-50 text-[#d33] border border-red-300 font-bold text-xs rounded flex items-center gap-1.5 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>رفض</span>
                        </button>
                      </div>

                      {rejectingId === rev.id && (
                        <div className="bg-red-50/50 border border-red-200 rounded p-3 space-y-2 text-xs">
                          <textarea
                            rows={2}
                            value={reason}
                            onChange={(e) => {
                              setReason(e.target.value);
                              setReasonError('');
                            }}
                            placeholder="اذكر سبب الرفض..."
                            className="w-full p-2 bg-white border border-[#a2a9b1] rounded"
                          />
                          {reasonError && (
                            <p className="text-[#d33] flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>{reasonError}</span>
                            </p>
                          )}
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setRejectingId(null)}
                              className="px-2.5 py-1 text-[#54595d] cursor-pointer"
                            >
                              إلغاء
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!reason.trim()) {
                                  setReasonError('يرجى إدخال سبب الرفض.');
                                  return;
                                }
                                onRejectRevision(rev.id, reason.trim());
                                setRejectingId(null);
                                setReason('');
                              }}
                              className="px-3 py-1 bg-[#d33] text-white font-bold rounded cursor-pointer"
                            >
                              تأكيد الرفض
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-900">
                      بانتظار موافقة أحد الأعضاء المشرفين: {article.designatedApprovers.join(' أو ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* سجل النسخ المعتمدة */}
      <div className="border border-[#eaecf0] rounded-md overflow-hidden bg-white">
        <div className="bg-[#f8f9fa] px-4 py-3 border-b border-[#eaecf0] flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#202122]">
            سجل المراجعات المعتمدة ({article.history.length})
          </h3>
          <span className="text-xs text-[#54595d]">من الأحدث إلى الأقدم</span>
        </div>
        <div className="divide-y divide-[#eaecf0] text-xs">
          {reversedHistory.map((rev, idx) => (
            <div key={rev.id} className="p-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono-tabular text-[11px] text-[#54595d]">
                  {rev.timestamp}
                </span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded font-bold">
                  {idx === 0 ? 'النسخة المعتمدة الحالية' : 'نسخة سابقة'}
                </span>
                <span>
                  المساهم: <strong className="text-[#3366cc]">{rev.author}</strong>
                </span>
                {rev.approver && (
                  <>
                    <span>·</span>
                    <span>
                      اعتماد: <strong>{rev.approver}</strong>
                    </span>
                  </>
                )}
              </div>
              <div className="text-[#54595d]">«{rev.summary}»</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- تبويب تحكم الصفحة المستقلة (Per-Page Control Panel) ---------------- */

function PageControlTab({
  article,
  members,
  isAdminSession,
  settings,
  canDeleteArticle,
  onSaveControls,
  onDeleteArticle
}: {
  article: Article;
  members: MemberAccount[];
  isAdminSession: boolean;
  settings: SystemSettings;
  canDeleteArticle: boolean;
  onSaveControls: (payload: {
    portal: WikiPortal;
    protectionLevel: ProtectionLevel;
    designatedApprovers: string[];
    imageUrl: string;
    imageCaption: string;
    categories: string[];
    subcategories: string[];
    isStub: boolean;
  }) => void;
  onDeleteArticle: () => void;
}) {
  const [portal, setPortal] = useState<WikiPortal>(article.portal);
  const [protectionLevel, setProtectionLevel] = useState<ProtectionLevel>(
    article.protectionLevel
  );
  const [approvers, setApprovers] = useState<string[]>(article.designatedApprovers);
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState<string>(
    members[0]?.name ?? ''
  );
  const [customApprover, setCustomApprover] = useState('');
  const [imageUrl, setImageUrl] = useState(article.imageUrl ?? '');
  const [imageCaption, setImageCaption] = useState(article.imageCaption ?? '');
  const [categoriesText, setCategoriesText] = useState(article.categories.join('، '));
  const [subcategoriesText, setSubcategoriesText] = useState(() =>
    getEffectiveSubcategories(article).join('، ')
  );
  const [isStubFlag, setIsStubFlag] = useState<boolean>(
    () => evaluateArticleStubStatus(article).isStub
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [imgStatus, setImgStatus] = useState<ImageLoadStatus>('idle');

  const ctrlStubEval = useMemo(() => evaluateArticleStubStatus(article), [article]);

  useEffect(() => {
    setPortal(article.portal);
    setProtectionLevel(article.protectionLevel);
    setApprovers(article.designatedApprovers);
    setImageUrl(article.imageUrl ?? '');
    setImageCaption(article.imageCaption ?? '');
    setCategoriesText(article.categories.join('، '));
    setSubcategoriesText(getEffectiveSubcategories(article).join('، '));
    setIsStubFlag(evaluateArticleStubStatus(article).isStub);
  }, [
    article.id,
    article.portal,
    article.protectionLevel,
    article.designatedApprovers,
    article.imageUrl,
    article.imageCaption,
    article.categories,
    article.subcategories,
    article.isStub
  ]);

  const imageValidation = useMemo(() => validateImageUrl(imageUrl), [imageUrl]);
  const safeImg = settings.allowImageUrls
    ? imageValidation.sanitized
    : sanitizeImageUrl(article.imageUrl);

  const selectedCtrlSubcats = subcategoriesText
    .split(/[،,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const toggleCtrlSubcategory = (sub: string) => {
    const exists = selectedCtrlSubcats.includes(sub);
    const next = exists
      ? selectedCtrlSubcats.filter((item) => item !== sub)
      : [...selectedCtrlSubcats, sub];
    setSubcategoriesText(next.join('، '));
  };

  const handleAddApprover = (nameToAdd: string) => {
    const trimmed = nameToAdd.trim();
    if (!trimmed || approvers.includes(trimmed)) return;
    setApprovers([...approvers, trimmed]);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (settings.allowImageUrls && !imageValidation.valid) {
      setError(
        imageValidation.error ??
          'رابط الصورة غير صالح. يجب أن يبدأ بـ https:// أو http://.'
      );
      return;
    }
    const cats = categoriesText
      .split(/[،,]/)
      .map((c) => c.trim())
      .filter(Boolean);

    const subcats = Array.from(
      new Set(
        subcategoriesText
          .split(/[،,]/)
          .map((s) => s.trim())
          .filter(Boolean)
      )
    ).slice(0, 20);

    onSaveControls({
      portal,
      protectionLevel,
      designatedApprovers:
        approvers.length > 0 ? approvers : [members[0]?.name ?? 'هيئة التحرير'],
      imageUrl: safeImg,
      imageCaption: imageCaption.trim(),
      categories: cats.length > 0 ? cats : [article.field],
      subcategories: subcats,
      isStub: isStubFlag
    });
    setError('');
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#eaecf0] pb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="wiki-title text-2xl font-bold text-[#202122] flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#3366cc]" aria-hidden="true" />
            <span>بطاقة تحكم صفحة: {article.name}</span>
          </h2>
          <p className="text-xs text-[#54595d] mt-1">
            التحكم المستقل بهذه الصفحة: البوابة، مستوى الحماية، الأعضاء المشرفون، وصورة الصفحة عبر رابط.
          </p>
        </div>
      </div>

      {!isAdminSession && (
        <div className="p-3 bg-[#f8f9fa] border border-[#a2a9b1] rounded text-xs text-[#54595d]">
          تُعرض إعدادات الحماية والإشراف الخاصة بهذه الصفحة في وضع القراءة العامة. تُجرى التعديلات الإدارية من قبل المشرفين المعتمدين، ويمكن للزوار اقتراح التعديلات عبر تبويب <strong>«اقترح تعديلاً»</strong>.
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-[#d33] text-xs rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5 text-xs">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* مستوى الحماية والبوابة */}
          <div className="border border-[#eaecf0] rounded p-4 bg-[#f8f9fa] space-y-3">
            <div className="font-bold text-sm text-[#202122] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#14866d]" aria-hidden="true" />
              <span>البوابة ونظام حماية الصفحة</span>
            </div>

            <div>
              <label htmlFor="ctrl-portal" className="block font-semibold mb-1">
                البوابة المنتمية إليها الصفحة
              </label>
              <select
                id="ctrl-portal"
                disabled={!isAdminSession}
                value={portal}
                onChange={(e) => setPortal(e.target.value as WikiPortal)}
                className="w-full p-2 bg-white border border-[#a2a9b1] rounded disabled:opacity-70"
              >
                {WIKI_PORTALS.map((p) => (
                  <option key={p.id} value={p.id}>
                    بوابة {p.shortLabel}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ctrl-protection" className="block font-semibold mb-1">
                مستوى الحماية والمراجعة
              </label>
              <select
                id="ctrl-protection"
                disabled={!isAdminSession}
                value={protectionLevel}
                onChange={(e) => setProtectionLevel(e.target.value as ProtectionLevel)}
                className="w-full p-2 bg-white border border-[#a2a9b1] rounded disabled:opacity-70"
              >
                <option value="semi-protected">
                  محمية جزئياً — المساهمات تتطلب موافقة الأعضاء المشرفين
                </option>
                <option value="strict-review">
                  مراجعة مشددة — توثيق المصادر إلزامي قبل الاعتماد
                </option>
                <option value="open">مساهمة مفتوحة مع تسجيل المراجعات</option>
              </select>
            </div>

            <div>
              <label htmlFor="ctrl-cats" className="block font-semibold mb-1">
                التصنيفات الرئيسية المرتبطة بالصفحة (مفصولة بفاصلة)
              </label>
              <input
                id="ctrl-cats"
                type="text"
                disabled={!isAdminSession}
                value={categoriesText}
                onChange={(e) => setCategoriesText(e.target.value)}
                className="w-full p-2 bg-white border border-[#a2a9b1] rounded disabled:opacity-70"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="ctrl-subcats" className="block font-semibold">
                التصنيفات الفرعية (مفصولة بفاصلة)
              </label>
              <input
                id="ctrl-subcats"
                type="text"
                disabled={!isAdminSession}
                value={subcategoriesText}
                onChange={(e) => setSubcategoriesText(e.target.value)}
                placeholder="مثال: شعراء وأدباء، أعلام خانقين..."
                className="w-full p-2 bg-white border border-[#a2a9b1] rounded disabled:opacity-70"
              />
              {isAdminSession && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {PORTAL_SUBCATEGORY_SUGGESTIONS[portal].map((sub) => {
                    const active = selectedCtrlSubcats.includes(sub);
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => toggleCtrlSubcategory(sub)}
                        className={`px-2 py-0.5 text-[11px] rounded border transition cursor-pointer ${
                          active
                            ? 'bg-[#e8f5f1] text-[#14866d] border-[#14866d] font-bold'
                            : 'bg-white text-[#54595d] border-[#c8ccd1] hover:border-[#14866d] hover:text-[#14866d]'
                        }`}
                      >
                        {active ? '✓ ' : '+ '}
                        {sub}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-[#eaecf0]">
              <label className="flex items-start gap-2.5 p-2.5 rounded border border-[#e2c98d] bg-[#fef9e7] cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isAdminSession}
                  checked={isStubFlag}
                  onChange={(e) => setIsStubFlag(e.target.checked)}
                  className="mt-0.5 rounded border-[#c7a75b] text-[#ac6600] disabled:opacity-60"
                />
                <span className="space-y-0.5">
                  <span className="font-bold text-[#613900] flex items-center gap-1.5">
                    <Sprout className="w-3.5 h-3.5 text-[#ac6600]" aria-hidden="true" />
                    <span>وسم الصفحة كـ «بذرة» (مقالة قصيرة غير مكتملة)</span>
                  </span>
                  <span className="block text-[11px] text-[#7a4b00] leading-relaxed">
                    الحجم الحالي: {ctrlStubEval.wordCount} كلمة · {ctrlStubEval.sectionCount} قسم ·{' '}
                    {ctrlStubEval.referenceCount} مرجع. عند التفعيل يظهر تنبيه مرئي أعلى المقالة لتشجيع الزوار على إثرائها وتُدرج ضمن فلتر البذور في لوحة التحكم.
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* الصورة الشخصية عبر رابط */}
          <div className="border border-[#eaecf0] rounded p-4 bg-[#f8f9fa] space-y-3">
            <div className="font-bold text-sm text-[#202122] flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-[#3366cc]" aria-hidden="true" />
              <span>صورة الصفحة عبر رابط (Image URL)</span>
            </div>
            <div>
              <label htmlFor="ctrl-img-url" className="block font-semibold mb-1">
                رابط الصورة
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="ctrl-img-url"
                  type="text"
                  inputMode="url"
                  dir="ltr"
                  disabled={!isAdminSession || !settings.allowImageUrls}
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="https://example.com/photo.jpg أو رابط Google Drive / Wikimedia"
                  className={`flex-1 p-2 bg-white border rounded disabled:opacity-70 focus:outline-none ${
                    imageUrl.trim() && !imageValidation.valid
                      ? 'border-[#d33] focus:border-[#d33]'
                      : 'border-[#a2a9b1] focus:border-[#3366cc]'
                  }`}
                />
                {isAdminSession && imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="px-2.5 py-2 bg-white hover:bg-gray-100 text-[#54595d] border border-[#a2a9b1] rounded cursor-pointer shrink-0"
                  >
                    مسح
                  </button>
                )}
              </div>
              {imageUrl.trim() && !imageValidation.valid && (
                <p className="text-[11px] text-[#d33] mt-1">{imageValidation.error}</p>
              )}
              {imageValidation.valid && imageValidation.transformedNote && (
                <p className="text-[11px] text-[#3366cc] mt-1">
                  {imageValidation.transformedNote}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="ctrl-img-cap" className="block font-semibold mb-1">
                وصف الصورة أسفل الإطار
              </label>
              <input
                id="ctrl-img-cap"
                type="text"
                disabled={!isAdminSession}
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
                className="w-full p-2 bg-white border border-[#a2a9b1] rounded disabled:opacity-70"
              />
            </div>
            <div className="pt-1 flex items-center gap-3">
              <PortraitMedallion
                articleId={article.id}
                initials={article.initials}
                name={article.name}
                tone={article.accentTone}
                imageUrl={safeImg}
                size="md"
                onStatusChange={setImgStatus}
              />
              <div className="text-[11px] leading-relaxed min-w-0">
                {!safeImg ? (
                  <span className="text-[#54595d]">
                    يعرض حالياً الشعار التوثيقي الافتراضي لعدم وجود رابط صورة.
                  </span>
                ) : imgStatus === 'loaded' ? (
                  <span className="text-[#14866d] font-medium">
                    تم تحميل الصورة من الرابط بنجاح وجاهزة للحفظ.
                  </span>
                ) : imgStatus === 'loading' ? (
                  <span className="text-[#54595d]">جارٍ تحميل معاينة الصورة من الرابط...</span>
                ) : (
                  <span className="text-[#ac6600] font-medium">
                    تعذر عرض الصورة من هذا الرابط؛ تأكد أنه رابط صورة مباشر (وليس رابط صفحة ويب) وأن الموقع لا يمنع العرض الخارجي.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* الأعضاء المشرفون على الصفحة */}
        <div className="border border-[#eaecf0] rounded p-4 bg-white space-y-3">
          <div className="font-bold text-sm text-[#202122]">
            الأعضاء المشرفون المخصصون لهذه الصفحة
          </div>
          <div className="flex flex-wrap gap-2">
            {approvers.map((app) => (
              <span
                key={app}
                className="inline-flex items-center gap-2 bg-[#f8f9fa] border border-[#a2a9b1] px-2.5 py-1 rounded text-xs"
              >
                <Shield className="w-3.5 h-3.5 text-[#14866d]" />
                <span>{app}</span>
                {isAdminSession && approvers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setApprovers(approvers.filter((a) => a !== app))}
                    className="text-[#54595d] hover:text-[#d33] cursor-pointer font-bold"
                    title="إزالة من إشراف هذه الصفحة"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>

          {isAdminSession && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#eaecf0]">
              <div className="flex items-center gap-2">
                <select
                  value={selectedMemberToAdd}
                  onChange={(e) => setSelectedMemberToAdd(e.target.value)}
                  className="flex-1 p-2 bg-white border border-[#a2a9b1] rounded"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleAddApprover(selectedMemberToAdd)}
                  className="px-3 py-2 bg-[#f8f9fa] hover:bg-[#eaf3ff] text-[#3366cc] border border-[#a2a9b1] rounded font-semibold cursor-pointer whitespace-nowrap"
                >
                  تعيين عضو
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customApprover}
                  onChange={(e) => setCustomApprover(e.target.value)}
                  placeholder="أو أضف اسم مشرف مخصص..."
                  className="flex-1 p-2 bg-white border border-[#a2a9b1] rounded"
                />
                <button
                  type="button"
                  onClick={() => {
                    handleAddApprover(customApprover);
                    setCustomApprover('');
                  }}
                  className="px-3 py-2 bg-[#f8f9fa] hover:bg-[#eaf3ff] text-[#3366cc] border border-[#a2a9b1] rounded font-semibold cursor-pointer whitespace-nowrap"
                >
                  إضافة
                </button>
              </div>
            </div>
          )}
        </div>

        {isAdminSession && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div>
              {canDeleteArticle &&
                (!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="px-3 py-2 text-[#d33] hover:bg-red-50 border border-red-200 rounded font-semibold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف هذه الصفحة</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded">
                    <span className="text-red-900 font-semibold">تأكيد حذف الصفحة نهائياً؟</span>
                    <button
                      type="button"
                      onClick={onDeleteArticle}
                      className="text-[#d33] font-bold hover:underline cursor-pointer"
                    >
                      نعم، احذف
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="text-[#54595d] cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                ))}
            </div>

            <button
              type="submit"
              className="px-5 py-2 bg-[#3366cc] hover:bg-[#2a4b8d] text-white font-bold text-sm rounded cursor-pointer"
            >
              حفظ إعدادات تحكم الصفحة
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

/* ---------------- تبويب النقاش ---------------- */

function TalkTab({
  article,
  isAdminSession,
  isSignedIn = true,
  userDisplayName,
  onSignIn,
  activeMemberName,
  onAddMessage
}: {
  article: Article;
  isAdminSession: boolean;
  isSignedIn?: boolean;
  userDisplayName?: string | null;
  onSignIn?: () => void;
  activeMemberName: string;
  onAddMessage: (author: string, topic: string, text: string) => void;
}) {
  const [author, setAuthor] = useState(() => (!isAdminSession && userDisplayName ? userDisplayName : ''));
  const [topic, setTopic] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignedIn) {
      setError('يرجى تسجيل الدخول عبر Google أولاً لإضافة ملاحظة توثيقية.');
      return;
    }
    if (text.trim().length < 2) {
      setError('يرجى كتابة نص الملاحظة التوثيقية (حرفان على الأقل).');
      return;
    }
    onAddMessage(
      author.trim() || (isAdminSession ? activeMemberName : userDisplayName || 'باحث زائر'),
      topic.trim() || 'ملاحظة توثيقية',
      text.trim()
    );
    setTopic('');
    setText('');
    setError('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#f8f9fa] border border-[#eaecf0] p-4 rounded-md text-xs text-[#54595d]">
        <strong className="text-[#202122] block mb-1">صفحة نقاش المقالة:</strong>
        مساحة مخصصة للباحثين والأعضاء لمناقشة دقة المعلومات والتحقق من الوثائق والمصادر.
      </div>

      {article.talkMessages.length === 0 ? (
        <div className="p-6 text-center text-xs text-[#54595d] border border-[#eaecf0] rounded">
          لا توجد نقاشات مفتوحة حول هذه المقالة حتى الآن.
        </div>
      ) : (
        <div className="space-y-4">
          {article.talkMessages.map((msg) => (
            <div
              key={msg.id}
              className="border border-[#eaecf0] rounded-md p-4 bg-white space-y-2"
            >
              <div className="flex items-center justify-between border-b border-[#eaecf0] pb-2 text-xs">
                <h4 className="font-bold text-[#3366cc] text-sm">
                  {msg.topic || 'ملاحظة توثيقية'}
                </h4>
                <span className="font-mono-tabular text-[#54595d]">{msg.createdAt}</span>
              </div>
              <p className="text-sm text-[#202122] leading-relaxed whitespace-pre-wrap">
                {msg.text}
              </p>
              <div className="text-xs text-[#54595d] pt-1">
                — كاتب الملاحظة: <strong className="text-[#202122]">{msg.author}</strong> (
                {msg.role === 'moderator' ? 'عضو مشرف' : 'باحث / مساهم'})
              </div>
            </div>
          ))}
        </div>
      )}

      {!isSignedIn && onSignIn && (
        <div className="bg-amber-50 border border-amber-300 rounded p-3.5 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="text-amber-950">
            <strong>تسجيل الدخول للمشاركة في النقاش:</strong> يمكنك تصفح جميع النقاشات بحرية، ولإضافة ملاحظة جديدة يرجى تسجيل الدخول بحساب Google الموثق.
          </div>
          <button
            type="button"
            onClick={onSignIn}
            className="px-3.5 py-1.5 bg-[#3366cc] hover:bg-[#2a4b8d] text-white font-bold rounded cursor-pointer shrink-0"
          >
            تسجيل الدخول عبر Google
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="border border-[#a2a9b1] rounded-md p-4 bg-[#f8f9fa] space-y-3 text-xs"
      >
        <h4 className="font-bold text-sm text-[#202122]">أضف ملاحظة أو استفساراً توثيقياً</h4>
        {error && (
          <div className="p-2 bg-red-50 border border-red-200 text-[#d33] rounded">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="talk-author" className="block font-semibold mb-1">
              الاسم أو الصفة
            </label>
            <input
              id="talk-author"
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder={
                isAdminSession ? activeMemberName : userDisplayName || 'باحث في التراث الفيلي'
              }
              className="w-full p-2 bg-white border border-[#a2a9b1] rounded"
            />
          </div>
          <div>
            <label htmlFor="talk-topic" className="block font-semibold mb-1">
              عنوان الموضوع
            </label>
            <input
              id="talk-topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="مثال: توثيق صورة أو مصدر تاريخي"
              className="w-full p-2 bg-white border border-[#a2a9b1] rounded"
            />
          </div>
        </div>
        <div>
          <label htmlFor="talk-content" className="block font-semibold mb-1">
            نص الملاحظة أو المصدر *
          </label>
          <textarea
            id="talk-content"
            rows={3}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError('');
            }}
            placeholder="اكتب ملاحظتك التوثيقية هنا..."
            className="w-full p-2 text-sm bg-white border border-[#a2a9b1] rounded"
          />
        </div>
        <button
          type="submit"
          disabled={!isSignedIn}
          className="px-4 py-1.5 bg-[#3366cc] hover:bg-[#2a4b8d] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded cursor-pointer"
        >
          نشر في صفحة النقاش
        </button>
      </form>
    </div>
  );
}
