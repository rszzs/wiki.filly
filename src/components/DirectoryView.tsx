import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronLeft,
  FilePlus2,
  FileWarning,
  Link2,
  Lock,
  MapPin,
  Settings,
  Sprout,
  Star,
  User
} from 'lucide-react';
import {
  Article,
  PendingRevision,
  WIKI_PORTALS,
  WikiPortal,
  formatPersonLifespan,
  getEffectiveSubcategories,
  getPlaceLocationSummary,
  inferArticleType,
  isEffectiveStub
} from '../types/encyclopedia';
import {
  getAbsoluteUrl,
  getArticlePath,
  getCategoryPath,
  getDirectoryPath,
  getHomePath,
  getPortalPath,
  getSubcategoryPath,
  shouldHandleClientNavigation
} from '../utils/routes';
import { stripWikitext } from './CitationText';
import { PortraitMedallion } from './PortraitMedallion';

interface DirectoryViewProps {
  articles: Article[];
  pendingRevisions: PendingRevision[];
  selectedPortal: WikiPortal | 'الكل';
  onSelectPortal: (portal: WikiPortal | 'الكل') => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  selectedSubcategory: string;
  onSelectSubcategory: (sub: string) => void;
  isAdminSession: boolean;
  onNavigateHome?: () => void;
  onOpenArticle: (id: string) => void;
  onOpenPageControl: (id: string) => void;
  onOpenNewArticle: () => void;
}

export function DirectoryView({
  articles,
  pendingRevisions,
  selectedPortal,
  onSelectPortal,
  selectedCategory,
  onSelectCategory,
  selectedSubcategory,
  onSelectSubcategory,
  isAdminSession,
  onNavigateHome,
  onOpenArticle,
  onOpenPageControl,
  onOpenNewArticle
}: DirectoryViewProps) {
  const [copiedPageUrl, setCopiedPageUrl] = useState(false);

  useEffect(() => {
    if (!copiedPageUrl) return;
    const timer = window.setTimeout(() => setCopiedPageUrl(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copiedPageUrl]);

  const portalFilteredArticles = useMemo(() => {
    if (selectedPortal === 'الكل') return articles;
    return articles.filter((a) => a.portal === selectedPortal);
  }, [articles, selectedPortal]);

  const allCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const art of portalFilteredArticles) {
      for (const cat of art.categories) {
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [portalFilteredArticles]);

  const categoryFilteredArticles = useMemo(() => {
    if (selectedCategory === 'الكل') return portalFilteredArticles;
    return portalFilteredArticles.filter((a) =>
      a.categories.includes(selectedCategory)
    );
  }, [portalFilteredArticles, selectedCategory]);

  const allSubcategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const art of categoryFilteredArticles) {
      for (const sub of getEffectiveSubcategories(art)) {
        counts.set(sub, (counts.get(sub) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [categoryFilteredArticles]);

  const filteredArticles = useMemo(() => {
    if (selectedSubcategory === 'الكل') return categoryFilteredArticles;
    return categoryFilteredArticles.filter((a) =>
      getEffectiveSubcategories(a).includes(selectedSubcategory)
    );
  }, [categoryFilteredArticles, selectedSubcategory]);

  const activePortalMeta = useMemo(
    () => WIKI_PORTALS.find((p) => p.id === selectedPortal),
    [selectedPortal]
  );

  const hasCategory = selectedCategory !== 'الكل' && selectedCategory.trim().length > 0;
  const hasSubcategory =
    selectedSubcategory !== 'الكل' && selectedSubcategory.trim().length > 0;

  const currentCanonicalPath = hasSubcategory
    ? getSubcategoryPath(selectedSubcategory, selectedPortal, selectedCategory)
    : hasCategory
      ? getCategoryPath(selectedCategory, selectedPortal)
      : getPortalPath(selectedPortal);
  const currentAbsoluteUrl = getAbsoluteUrl(currentCanonicalPath);

  const handleCopyCurrentUrl = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentAbsoluteUrl);
        setCopiedPageUrl(true);
      }
    } catch {
      setCopiedPageUrl(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* مسار التنقل الهيكلي (SEO Breadcrumb) + نسخ الرابط الدائم للبوابة أو التصنيف */}
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
          {activePortalMeta ? (
            <>
              <li>
                <a
                  href={getPortalPath(activePortalMeta.id)}
                  onClick={(e) => {
                    if (shouldHandleClientNavigation(e)) {
                      e.preventDefault();
                      onSelectPortal(activePortalMeta.id);
                    }
                  }}
                  aria-current={!hasCategory && !hasSubcategory ? 'page' : undefined}
                  className={
                    hasCategory || hasSubcategory
                      ? 'text-[#3366cc] hover:underline'
                      : 'text-[#202122] font-medium'
                  }
                >
                  بوابة {activePortalMeta.shortLabel}
                </a>
              </li>
              {hasCategory && (
                <>
                  <li aria-hidden="true">
                    <ChevronLeft className="w-3 h-3 text-[#a2a9b1]" />
                  </li>
                  <li>
                    {hasSubcategory ? (
                      <a
                        href={getCategoryPath(selectedCategory, activePortalMeta.id)}
                        onClick={(e) => {
                          if (shouldHandleClientNavigation(e)) {
                            e.preventDefault();
                            onSelectCategory(selectedCategory);
                          }
                        }}
                        className="text-[#3366cc] hover:underline"
                      >
                        تصنيف: {selectedCategory}
                      </a>
                    ) : (
                      <span aria-current="page" className="text-[#202122] font-medium">
                        تصنيف: {selectedCategory}
                      </span>
                    )}
                  </li>
                </>
              )}
              {hasSubcategory && (
                <>
                  <li aria-hidden="true">
                    <ChevronLeft className="w-3 h-3 text-[#a2a9b1]" />
                  </li>
                  <li aria-current="page" className="text-[#202122] font-medium">
                    تصنيف فرعي: {selectedSubcategory}
                  </li>
                </>
              )}
            </>
          ) : hasCategory || hasSubcategory ? (
            <>
              <li>
                <a
                  href={getDirectoryPath()}
                  onClick={(e) => {
                    if (shouldHandleClientNavigation(e)) {
                      e.preventDefault();
                      onSelectPortal('الكل');
                    }
                  }}
                  className="text-[#3366cc] hover:underline"
                >
                  الفهرس والبوابات
                </a>
              </li>
              {hasCategory && (
                <>
                  <li aria-hidden="true">
                    <ChevronLeft className="w-3 h-3 text-[#a2a9b1]" />
                  </li>
                  <li>
                    {hasSubcategory ? (
                      <a
                        href={getCategoryPath(selectedCategory, 'الكل')}
                        onClick={(e) => {
                          if (shouldHandleClientNavigation(e)) {
                            e.preventDefault();
                            onSelectCategory(selectedCategory);
                          }
                        }}
                        className="text-[#3366cc] hover:underline"
                      >
                        تصنيف: {selectedCategory}
                      </a>
                    ) : (
                      <span aria-current="page" className="text-[#202122] font-medium">
                        تصنيف: {selectedCategory}
                      </span>
                    )}
                  </li>
                </>
              )}
              {hasSubcategory && (
                <>
                  <li aria-hidden="true">
                    <ChevronLeft className="w-3 h-3 text-[#a2a9b1]" />
                  </li>
                  <li aria-current="page" className="text-[#202122] font-medium">
                    تصنيف فرعي: {selectedSubcategory}
                  </li>
                </>
              )}
            </>
          ) : (
            <li aria-current="page" className="text-[#202122] font-medium">
              دليل المقالات والبوابات
            </li>
          )}
        </ol>

        <button
          type="button"
          onClick={handleCopyCurrentUrl}
          className="inline-flex items-center gap-1 text-[11px] text-[#54595d] hover:text-[#3366cc] transition cursor-pointer"
          title={`نسخ الرابط الدائم: ${currentAbsoluteUrl}`}
        >
          {copiedPageUrl ? (
            <>
              <Check className="w-3 h-3 text-[#14866d]" aria-hidden="true" />
              <span className="text-[#14866d] font-medium">تم نسخ رابط الصفحة</span>
            </>
          ) : (
            <>
              <Link2 className="w-3 h-3" aria-hidden="true" />
              <span>
                {hasSubcategory
                  ? 'نسخ رابط التصنيف الفرعي'
                  : hasCategory
                    ? 'نسخ رابط التصنيف'
                    : activePortalMeta
                      ? 'نسخ رابط البوابة'
                      : 'نسخ رابط الفهرس'}
              </span>
            </>
          )}
        </button>
      </nav>

      <div className="border-b border-[#a2a9b1] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-[#3366cc]">
            ويكي فيلي · البوابات والتصنيفات الرئيسية والفرعية
          </div>
          <h1 className="wiki-title text-3xl sm:text-4xl font-bold text-[#202122] mt-1">
            {hasSubcategory && hasCategory && activePortalMeta
              ? `بوابة ${activePortalMeta.shortLabel} — ${selectedCategory} / ${selectedSubcategory}`
              : hasSubcategory && activePortalMeta
                ? `بوابة ${activePortalMeta.shortLabel} — تصنيف فرعي: ${selectedSubcategory}`
                : hasSubcategory && hasCategory
                  ? `${selectedCategory} — تصنيف فرعي: ${selectedSubcategory}`
                  : hasSubcategory
                    ? `تصنيف فرعي: ${selectedSubcategory}`
                    : activePortalMeta && hasCategory
                      ? `بوابة ${activePortalMeta.shortLabel} — تصنيف: ${selectedCategory}`
                      : activePortalMeta
                        ? `بوابة ${activePortalMeta.shortLabel}`
                        : hasCategory
                          ? `تصنيف: ${selectedCategory}`
                          : 'دليل مقالات وبوابات ويكي فيلي'}
          </h1>
          <p className="text-sm text-[#54595d] mt-1">
            {hasSubcategory
              ? `المقالات الموثقة ضمن التصنيف الفرعي «${selectedSubcategory}»${
                  hasCategory ? ` في تصنيف «${selectedCategory}»` : ''
                } (${filteredArticles.length} مقالة).`
              : hasCategory
                ? `جميع المقالات الموثقة ضمن تصنيف «${selectedCategory}» (${filteredArticles.length} مقالة).`
                : activePortalMeta
                  ? activePortalMeta.description
                  : 'تصفح جميع المقالات والسير والعشائر والأماكن والفنون والأحداث التاريخية الفيلية الموثقة.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewArticle}
          className="px-4 py-2 bg-[#3366cc] hover:bg-[#2a4b8d] text-white text-xs sm:text-sm font-bold rounded transition inline-flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <FilePlus2 className="w-4 h-4" aria-hidden="true" />
          <span>إضافة مقالة جديدة</span>
        </button>
      </div>

      {/* تصفية حسب البوابة (روابط SEO مستقلة لكل بوابة) */}
      <div className="space-y-2">
        <nav
          aria-label="بوابات الموسوعة"
          className="flex flex-wrap items-center gap-1.5 p-2 bg-[#f8f9fa] border border-[#a2a9b1]/60 rounded"
        >
          <a
            href={getDirectoryPath()}
            onClick={(e) => {
              if (shouldHandleClientNavigation(e)) {
                e.preventDefault();
                onSelectPortal('الكل');
              }
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded transition ${
              selectedPortal === 'الكل' && !hasCategory && !hasSubcategory
                ? 'bg-[#3366cc] text-white font-bold'
                : 'text-[#202122] hover:bg-[#eaf3ff] hover:text-[#3366cc]'
            }`}
          >
            جميع البوابات ({articles.length})
          </a>
          {WIKI_PORTALS.map((portal) => {
            const count = articles.filter((a) => a.portal === portal.id).length;
            return (
              <a
                key={portal.id}
                href={getPortalPath(portal.id)}
                onClick={(e) => {
                  if (shouldHandleClientNavigation(e)) {
                    e.preventDefault();
                    onSelectPortal(portal.id);
                  }
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                  selectedPortal === portal.id
                    ? 'bg-[#3366cc] text-white font-bold'
                    : 'text-[#202122] hover:bg-[#eaf3ff] hover:text-[#3366cc]'
                }`}
              >
                {portal.shortLabel} ({count})
              </a>
            );
          })}
        </nav>

        {/* المستوى الثاني: تصفية التصنيفات الرئيسية (روابط SEO مستقلة لكل تصنيف) */}
        {allCategories.length > 0 && (
          <nav
            aria-label="التصنيفات الرئيسية"
            className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 bg-white border border-[#eaecf0] rounded"
          >
            <span className="text-[11px] font-bold text-[#54595d] ml-1">
              التصنيف الرئيسي:
            </span>
            <a
              href={getPortalPath(selectedPortal)}
              onClick={(e) => {
                if (shouldHandleClientNavigation(e)) {
                  e.preventDefault();
                  onSelectCategory('الكل');
                }
              }}
              className={`px-2.5 py-1 text-[11px] rounded transition ${
                selectedCategory === 'الكل'
                  ? 'bg-[#eaf3ff] text-[#3366cc] font-bold border border-[#3366cc]/30'
                  : 'text-[#54595d] hover:bg-[#f8f9fa]'
              }`}
            >
              الكل ({portalFilteredArticles.length})
            </a>
            {allCategories.map(([cat, count]) => (
              <a
                key={cat}
                href={getCategoryPath(cat, selectedPortal)}
                onClick={(e) => {
                  if (shouldHandleClientNavigation(e)) {
                    e.preventDefault();
                    onSelectCategory(cat);
                  }
                }}
                className={`px-2.5 py-1 text-[11px] rounded transition ${
                  selectedCategory === cat
                    ? 'bg-[#eaf3ff] text-[#3366cc] font-bold border border-[#3366cc]/30'
                    : 'text-[#54595d] hover:bg-[#f8f9fa]'
                }`}
              >
                {cat} ({count})
              </a>
            ))}
          </nav>
        )}

        {/* المستوى الثالث: تصفية التصنيفات الفرعية (روابط SEO مستقلة لكل تصنيف فرعي) */}
        {allSubcategories.length > 0 && (
          <nav
            aria-label="التصنيفات الفرعية"
            className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 bg-[#f8f9fa]/70 border border-[#eaecf0] rounded"
          >
            <span className="text-[11px] font-bold text-[#14866d] ml-1">
              التصنيف الفرعي:
            </span>
            <a
              href={
                hasCategory
                  ? getCategoryPath(selectedCategory, selectedPortal)
                  : getPortalPath(selectedPortal)
              }
              onClick={(e) => {
                if (shouldHandleClientNavigation(e)) {
                  e.preventDefault();
                  onSelectSubcategory('الكل');
                }
              }}
              className={`px-2.5 py-1 text-[11px] rounded transition ${
                selectedSubcategory === 'الكل'
                  ? 'bg-[#e8f5f1] text-[#14866d] font-bold border border-[#14866d]/30'
                  : 'text-[#54595d] hover:bg-white'
              }`}
            >
              الكل ({categoryFilteredArticles.length})
            </a>
            {allSubcategories.map(([sub, count]) => (
              <a
                key={sub}
                href={getSubcategoryPath(sub, selectedPortal, selectedCategory)}
                onClick={(e) => {
                  if (shouldHandleClientNavigation(e)) {
                    e.preventDefault();
                    onSelectSubcategory(sub);
                  }
                }}
                className={`px-2.5 py-1 text-[11px] rounded transition ${
                  selectedSubcategory === sub
                    ? 'bg-[#e8f5f1] text-[#14866d] font-bold border border-[#14866d]/30'
                    : 'text-[#54595d] hover:bg-white hover:text-[#14866d]'
                }`}
              >
                {sub} <span className="font-mono-tabular">({count})</span>
              </a>
            ))}
          </nav>
        )}
      </div>

      {/* قائمة المقالات */}
      {filteredArticles.length === 0 ? (
        <div className="p-10 text-center border border-[#eaecf0] rounded bg-[#f8f9fa] space-y-3">
          <div className="font-bold text-sm text-[#202122]">
            لا توجد مقالات مطابقة للتصفية الحالية
          </div>
          <p className="text-xs text-[#54595d]">
            يمكنك المساهمة بتسجيل أول مقالة في هذا التصنيف لإثراء ويكي فيلي.
          </p>
          <button
            type="button"
            onClick={onOpenNewArticle}
            className="px-4 py-1.5 bg-[#3366cc] text-white text-xs font-bold rounded cursor-pointer"
          >
            + ساهم بمقالة جديدة
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredArticles.map((art) => {
            const pendingCount = pendingRevisions.filter(
              (r) => r.articleId === art.id
            ).length;
            const artType = inferArticleType(art);
            const artHref = getArticlePath(art.id);
            const personLifespan = artType === 'person' ? formatPersonLifespan(art) : '';
            const placeLocation = artType === 'place' ? getPlaceLocationSummary(art) : '';

            return (
              <article
                key={art.id}
                className="bg-white border border-[#a2a9b1] rounded-xs p-4 flex flex-col justify-between gap-4 hover:border-[#3366cc] transition"
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <PortraitMedallion
                      articleId={art.id}
                      initials={art.initials}
                      name={art.name}
                      tone={art.accentTone}
                      imageUrl={art.imageUrl}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#14866d]">
                        <a
                          href={getPortalPath(art.portal)}
                          onClick={(e) => {
                            if (shouldHandleClientNavigation(e)) {
                              e.preventDefault();
                              onSelectPortal(art.portal);
                            }
                          }}
                          className="hover:underline"
                        >
                          {art.portal}
                        </a>
                      </div>
                      <h2 className="wiki-title text-xl font-bold text-[#3366cc] leading-snug">
                        <a
                          href={artHref}
                          onClick={(e) => {
                            if (shouldHandleClientNavigation(e)) {
                              e.preventDefault();
                              onOpenArticle(art.id);
                            }
                          }}
                          className="text-right hover:underline"
                        >
                          {art.name}
                        </a>
                      </h2>
                      <div className="text-xs text-[#54595d] line-clamp-1 mt-0.5">
                        {art.subtitle}
                      </div>
                    </div>
                  </div>

                  {/* شريط البيانات المخصص حسب نوع المقال (شخصية / منطقة / موضوع عام) */}
                  <div className="text-xs text-[#54595d] border-y border-[#eaecf0] py-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-[#202122]">{art.field}</span>
                    {artType === 'person' && (
                      <>
                        {personLifespan && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 font-mono-tabular">
                              <User className="w-3 h-3 text-[#3366cc]" aria-hidden="true" />
                              {personLifespan}
                            </span>
                          </>
                        )}
                        {art.birthplace?.trim() && art.birthplace !== 'غير محدد' && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-[150px]">{art.birthplace}</span>
                          </>
                        )}
                      </>
                    )}
                    {artType === 'place' && (
                      <>
                        {placeLocation && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                              <MapPin className="w-3 h-3 text-[#14866d] shrink-0" aria-hidden="true" />
                              <span className="truncate">{placeLocation}</span>
                            </span>
                          </>
                        )}
                      </>
                    )}
                    {artType === 'general' && (
                      <>
                        {(art.historicalEra?.trim() || art.activeYears?.trim()) && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-[200px]">
                              {art.historicalEra?.trim() || art.activeYears}
                            </span>
                          </>
                        )}
                      </>
                    )}
                  </div>

                  <p className="text-xs text-[#202122] leading-relaxed line-clamp-3">
                    {stripWikitext(art.summary)}
                  </p>

                  {(() => {
                    const artSubs = getEffectiveSubcategories(art);
                    if (artSubs.length === 0) return null;
                    return (
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-[#54595d] pt-1">
                        <span className="font-semibold text-[#54595d]">فرعي:</span>
                        {artSubs.slice(0, 3).map((sub, idx) => (
                          <span key={sub} className="inline-flex items-center gap-1.5">
                            <a
                              href={getSubcategoryPath(sub, selectedPortal, selectedCategory)}
                              onClick={(e) => {
                                if (shouldHandleClientNavigation(e)) {
                                  e.preventDefault();
                                  onSelectSubcategory(sub);
                                }
                              }}
                              className="text-[#14866d] hover:underline"
                            >
                              {sub}
                            </a>
                            {idx < Math.min(artSubs.length, 3) - 1 && (
                              <span aria-hidden="true" className="text-[#a2a9b1]">
                                ·
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div className="pt-2 border-t border-[#eaecf0] flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#54595d]">
                      <Lock className="w-3 h-3 text-[#3366cc]" aria-hidden="true" />
                      <span>
                        {pendingCount > 0 ? `${pendingCount} مساهمة معلقة` : 'موثقة'}
                      </span>
                    </span>
                    {art.isFeatured && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-[#eefaf5] border border-[#9fd5c8] text-[#0e6b57] font-bold text-[10px]"
                        title="مقالة متميزة وموثّقة في ويكي فيلي"
                      >
                        <Star className="w-2.5 h-2.5 text-[#14866d] fill-[#14866d]" aria-hidden="true" />
                        <span>متميزة</span>
                      </span>
                    )}
                    {isEffectiveStub(art) && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-[#fef9e7] border border-[#e2c98d] text-[#8a5300] font-bold text-[10px]"
                        title="مقالة بذرة قصيرة تحتاج إلى إثراء ومساهمة"
                      >
                        <Sprout className="w-2.5 h-2.5 text-[#ac6600]" aria-hidden="true" />
                        <span>بذرة</span>
                      </span>
                    )}
                    {art.needsSources && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-[#fef2f2] border border-[#f2c2c2] text-[#9b1c1c] font-bold text-[10px]"
                        title="بحاجة إلى مصادر ومراجع موثوقة"
                      >
                        <FileWarning className="w-2.5 h-2.5 text-[#b32424]" aria-hidden="true" />
                        <span>بحاجة لمصادر</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdminSession && (
                      <button
                        type="button"
                        onClick={() => onOpenPageControl(art.id)}
                        className="px-2.5 py-1 bg-[#f8f9fa] hover:bg-[#eaf3ff] text-[#202122] border border-[#a2a9b1] rounded inline-flex items-center gap-1 cursor-pointer"
                        title="لوحة تحكم هذه الصفحة"
                      >
                        <Settings className="w-3 h-3" aria-hidden="true" />
                        <span>تحكم</span>
                      </button>
                    )}
                    <a
                      href={artHref}
                      onClick={(e) => {
                        if (shouldHandleClientNavigation(e)) {
                          e.preventDefault();
                          onOpenArticle(art.id);
                        }
                      }}
                      className="px-3 py-1 bg-[#3366cc] hover:bg-[#2a4b8d] text-white rounded inline-flex items-center gap-1 font-medium"
                    >
                      <BookOpen className="w-3 h-3" aria-hidden="true" />
                      <span>اقرأ المقالة</span>
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
