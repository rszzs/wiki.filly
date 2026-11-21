import React, { useMemo } from 'react';
import {
  Award,
  BookOpen,
  Compass,
  FolderTree,
  Landmark,
  MapPin,
  Music,
  Newspaper,
  Sparkles,
  Users
} from 'lucide-react';
import {
  Article,
  SystemSettings,
  WIKI_PORTALS,
  WikiPortal,
  formatPersonLifespan,
  getEffectiveSubcategories,
  getPlaceLocationSummary,
  inferArticleType
} from '../types/encyclopedia';
import {
  getArticlePath,
  getCategoryPath,
  getDirectoryPath,
  getPortalPath,
  getSubcategoryPath,
  shouldHandleClientNavigation
} from '../utils/routes';
import { stripWikitext } from './CitationText';
import { PortraitMedallion } from './PortraitMedallion';

interface HomePageViewProps {
  articles: Article[];
  settings: SystemSettings;
  onOpenArticle: (id: string) => void;
  onSelectPortal: (portal: WikiPortal) => void;
  onSelectCategory: (cat: string) => void;
  onSelectSubcategory: (sub: string) => void;
  onOpenDirectory: () => void;
  onOpenNewArticle: () => void;
}

const PORTAL_ICONS: Record<WikiPortal, typeof Users> = {
  'شخصيات وأعلام': Users,
  'عشائر وأنساب': Compass,
  'فنون وثقافة': Music,
  'أماكن ومدن': MapPin,
  'أحداث تاريخية': Landmark,
  'إعلام وسياسة': Newspaper
};

export function HomePageView({
  articles,
  settings,
  onOpenArticle,
  onSelectPortal,
  onSelectCategory,
  onSelectSubcategory,
  onOpenDirectory,
  onOpenNewArticle
}: HomePageViewProps) {
  const featuredArticle = articles[0];
  const featuredType = featuredArticle ? inferArticleType(featuredArticle) : 'general';
  const featuredTagline = featuredArticle
    ? featuredType === 'person'
      ? formatPersonLifespan(featuredArticle)
      : featuredType === 'place'
        ? getPlaceLocationSummary(featuredArticle)
        : featuredArticle.historicalEra?.trim() || featuredArticle.activeYears
    : '';
  const featuredFooterMeta = featuredArticle
    ? featuredType === 'person'
      ? [featuredArticle.birthplace, featuredArticle.field].filter(Boolean).join(' · ')
      : featuredType === 'place'
        ? [getPlaceLocationSummary(featuredArticle), featuredArticle.field]
            .filter(Boolean)
            .join(' · ')
        : [featuredArticle.portal, featuredArticle.field].filter(Boolean).join(' · ')
    : '';

  const secondaryHighlights = useMemo(
    () => articles.filter((a) => a.portal !== 'شخصيات وأعلام'),
    [articles]
  );
  const figureArticles = useMemo(
    () => articles.filter((a) => a.portal === 'شخصيات وأعلام'),
    [articles]
  );
  const recentlyUpdated = useMemo(
    () =>
      [...articles]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 6),
    [articles]
  );
  const topCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const art of articles) {
      for (const cat of art.categories) {
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14);
  }, [articles]);

  const topSubcategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const art of articles) {
      for (const sub of getEffectiveSubcategories(art)) {
        counts.set(sub, (counts.get(sub) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16);
  }, [articles]);

  return (
    <div className="space-y-5">
      {/* شريط تبويبات الصفحة على طراز ويكيبيديا العربية */}
      <div className="border-b border-[#a2a9b1] pb-1.5 flex items-baseline justify-end gap-2">
        <div className="flex items-center gap-4 text-xs">
          <a
            href={getDirectoryPath()}
            onClick={(e) => {
              if (shouldHandleClientNavigation(e)) {
                e.preventDefault();
                onOpenDirectory();
              }
            }}
            className="text-[#3366cc] hover:underline"
          >
            فهرس المقالات
          </a>
          <button
            type="button"
            onClick={onOpenNewArticle}
            className="text-[#3366cc] hover:underline cursor-pointer"
          >
            ساهم بمقالة
          </button>
        </div>
      </div>

      {/* صندوق الترحيب الرئيسي المطابق لترتيب ويكيبيديا العربية */}
      <section className="bg-[#f9f9f9] border border-[#ddd] rounded-xs px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="wiki-title text-2xl sm:text-3xl font-bold text-[#202122]">
            مرحباً بكم في {settings.siteName}،
          </h1>
          <p className="text-sm text-[#202122]">
            الموسوعة الحرة للأكراد الفيليين التي توثق الأعلام، العشائر، الأماكن، الفنون،
            الأحداث التاريخية، والإعلام والسياسة.
          </p>
        </div>

        <div className="md:text-left space-y-1.5 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-[#eaecf0]">
          <div className="text-xs text-[#202122]">
            يضم ويكي فيلي حالياً{' '}
            <a
              href={getDirectoryPath()}
              onClick={(e) => {
                if (shouldHandleClientNavigation(e)) {
                  e.preventDefault();
                  onOpenDirectory();
                }
              }}
              className="font-mono-tabular font-bold text-[#3366cc] hover:underline"
            >
              {articles.length}
            </a>{' '}
            مقالةً في{' '}
            <strong className="font-mono-tabular">{WIKI_PORTALS.length}</strong> بوابات
          </div>
          <div className="flex flex-wrap md:justify-end items-center gap-2 text-xs text-[#3366cc]">
            <a
              href={getPortalPath('شخصيات وأعلام')}
              onClick={(e) => {
                if (shouldHandleClientNavigation(e)) {
                  e.preventDefault();
                  onSelectPortal('شخصيات وأعلام');
                }
              }}
              className="hover:underline"
            >
              الشخصيات ({figureArticles.length})
            </a>
            <span className="text-[#a2a9b1]">·</span>
            <a
              href={getDirectoryPath()}
              onClick={(e) => {
                if (shouldHandleClientNavigation(e)) {
                  e.preventDefault();
                  onOpenDirectory();
                }
              }}
              className="hover:underline"
            >
              دليل المقالات
            </a>
            <span className="text-[#a2a9b1]">·</span>
            <button
              type="button"
              onClick={onOpenNewArticle}
              className="font-bold hover:underline cursor-pointer"
            >
              أنشئ مقالة جديدة
            </button>
          </div>
        </div>
      </section>

      {/* تخطيط العمودين الكلاسيكي لويكيبيديا العربية */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* العمود الأيمن (~58%): مقالة مختارة + في العشائر والأماكن + أعلام فيليون */}
        <div className="lg:col-span-7 space-y-4">
          {/* 1. مقالة مختارة (الإطار الأزرق الفاتح الكلاسيكي لويكيبيديا) */}
          {featuredArticle && (
            <section className="border border-[#a7d7f9] bg-white rounded-xs overflow-hidden">
              <div className="bg-[#cedff2] border-b border-[#a7d7f9] px-3.5 py-2 flex items-center justify-between">
                <h2 className="wiki-title text-lg font-bold text-[#202122] flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#2a4b8d]" aria-hidden="true" />
                  <span>مقالة مختارة</span>
                </h2>
                <a
                  href={getPortalPath(featuredArticle.portal)}
                  onClick={(e) => {
                    if (shouldHandleClientNavigation(e)) {
                      e.preventDefault();
                      onSelectPortal(featuredArticle.portal);
                    }
                  }}
                  className="text-xs text-[#2a4b8d] hover:underline"
                >
                  بوابة {featuredArticle.portal}
                </a>
              </div>

              <div className="p-4 space-y-3 text-sm leading-relaxed text-[#202122]">
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="shrink-0">
                    <PortraitMedallion
                      articleId={featuredArticle.id}
                      initials={featuredArticle.initials}
                      name={featuredArticle.name}
                      tone={featuredArticle.accentTone}
                      imageUrl={featuredArticle.imageUrl}
                      size="md"
                    />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <p>
                      <a
                        href={getArticlePath(featuredArticle.id)}
                        onClick={(e) => {
                          if (shouldHandleClientNavigation(e)) {
                            e.preventDefault();
                            onOpenArticle(featuredArticle.id);
                          }
                        }}
                        className="font-bold text-[#3366cc] hover:underline"
                      >
                        {featuredArticle.name}
                      </a>
                      {featuredTagline ? ` (${featuredTagline})` : ''} —{' '}
                      {featuredArticle.subtitle}.{' '}
                      {stripWikitext(featuredArticle.summary)}
                    </p>
                  </div>
                </div>

                {featuredArticle.sections[0] && (
                  <p className="text-[13px] text-[#54595d] line-clamp-3 border-t border-[#eaecf0] pt-2.5">
                    <strong className="text-[#202122]">
                      {featuredArticle.sections[0].title}:
                    </strong>{' '}
                    {stripWikitext(featuredArticle.sections[0].content)}
                  </p>
                )}

                <div className="pt-1 flex items-center justify-between text-xs">
                  <span className="text-[#54595d]">{featuredFooterMeta}</span>
                  <a
                    href={getArticlePath(featuredArticle.id)}
                    onClick={(e) => {
                      if (shouldHandleClientNavigation(e)) {
                        e.preventDefault();
                        onOpenArticle(featuredArticle.id);
                      }
                    }}
                    className="font-bold text-[#3366cc] hover:underline"
                  >
                    اقرأ المقالة كاملة...
                  </a>
                </div>
              </div>
            </section>
          )}

          {/* 2. في العشائر والأماكن والفنون والأحداث (الإطار الأخضر الفاتح الكلاسيكي لويكيبيديا) */}
          <section className="border border-[#a3bfb1] bg-white rounded-xs overflow-hidden">
            <div className="bg-[#cef2e0] border-b border-[#a3bfb1] px-3.5 py-2 flex items-center justify-between">
              <h2 className="wiki-title text-lg font-bold text-[#202122] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#14866d]" aria-hidden="true" />
                <span>من العشائر والأماكن والفنون والأحداث</span>
              </h2>
              <a
                href={getDirectoryPath()}
                onClick={(e) => {
                  if (shouldHandleClientNavigation(e)) {
                    e.preventDefault();
                    onOpenDirectory();
                  }
                }}
                className="text-xs text-[#14866d] hover:underline"
              >
                المزيد
              </a>
            </div>

            <div className="p-4">
              <ul className="space-y-3 text-[13.5px] leading-relaxed text-[#202122]">
                {secondaryHighlights.map((item) => (
                  <li key={item.id} className="flex items-start gap-2">
                    <span className="text-[#14866d] font-bold mt-0.5">•</span>
                    <div>
                      <a
                        href={getArticlePath(item.id)}
                        onClick={(e) => {
                          if (shouldHandleClientNavigation(e)) {
                            e.preventDefault();
                            onOpenArticle(item.id);
                          }
                        }}
                        className="font-bold text-[#3366cc] hover:underline"
                      >
                        {item.name}
                      </a>{' '}
                      <span className="text-xs text-[#54595d]">({item.portal}):</span>{' '}
                      <span>{stripWikitext(item.summary)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* 3. من أعلام الكرد الفيليين (الإطار الكريمي الكلاسيكي لويكيبيديا) */}
          <section className="border border-[#dad2ba] bg-white rounded-xs overflow-hidden">
            <div className="bg-[#faecc8] border-b border-[#dad2ba] px-3.5 py-2 flex items-center justify-between">
              <h2 className="wiki-title text-lg font-bold text-[#202122] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#7c5800]" aria-hidden="true" />
                <span>أعلام وشخصيات فيلية موثقة</span>
              </h2>
              <a
                href={getPortalPath('شخصيات وأعلام')}
                onClick={(e) => {
                  if (shouldHandleClientNavigation(e)) {
                    e.preventDefault();
                    onSelectPortal('شخصيات وأعلام');
                  }
                }}
                className="text-xs text-[#7c5800] hover:underline"
              >
                كل الأعلام ({figureArticles.length})
              </a>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {figureArticles.map((fig) => {
                const lifespan = formatPersonLifespan(fig);
                return (
                  <a
                    key={fig.id}
                    href={getArticlePath(fig.id)}
                    onClick={(e) => {
                      if (shouldHandleClientNavigation(e)) {
                        e.preventDefault();
                        onOpenArticle(fig.id);
                      }
                    }}
                    className="text-right p-2.5 border border-[#eaecf0] hover:border-[#3366cc] hover:bg-[#f8f9fa] rounded-xs transition flex items-center gap-2.5"
                  >
                    <PortraitMedallion
                      articleId={fig.id}
                      initials={fig.initials}
                      name={fig.name}
                      tone={fig.accentTone}
                      imageUrl={fig.imageUrl}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-[#3366cc] truncate">
                        {fig.name}
                      </div>
                      <div className="text-[11px] text-[#54595d] truncate">
                        {fig.field}
                        {lifespan ? ` · ${lifespan}` : ''}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        </div>

        {/* العمود الأيسر (~42%): بوابات ويكي فيلي + أحدث المقالات المحدثة */}
        <div className="lg:col-span-5 space-y-4 text-[14px] leading-[1.6]">
          {/* 1. بوابات الموسوعة (الإطار البنفسجي الفاتح الكلاسيكي لويكيبيديا) */}
          <section className="border border-[#afa3bf] bg-white rounded-xs overflow-hidden">
            <div className="bg-[#ddcef2] border-b border-[#afa3bf] px-3.5 py-2 flex items-center justify-between">
              <h2 className="wiki-title text-[18px] leading-[1.35] font-bold text-[#202122] flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#4c3775]" aria-hidden="true" />
                <span>بوابات ويكي فيلي</span>
              </h2>
              <span className="text-xs leading-[1.5] text-[#4c3775] font-mono-tabular">
                {WIKI_PORTALS.length} بوابات
              </span>
            </div>

            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {WIKI_PORTALS.map((portal) => {
                const Icon = PORTAL_ICONS[portal.id];
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
                    className="text-right p-3 bg-[#f8f9fa] hover:bg-[#eaf3ff] border border-[#eaecf0] hover:border-[#3366cc] rounded-xs transition flex items-start gap-2.5 group"
                  >
                    <Icon
                      className="w-4 h-4 text-[#3366cc] shrink-0 mt-1"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-bold text-[13.5px] leading-[1.4] text-[#3366cc] group-hover:underline truncate">
                          {portal.shortLabel}
                        </span>
                        <span className="font-mono-tabular text-xs leading-[1.4] text-[#54595d]">
                          ({count})
                        </span>
                      </div>
                      <p className="text-[12.5px] text-[#54595d] line-clamp-2 mt-1 leading-[1.6]">
                        {portal.description}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>

          {/* 2. أحدث التحديثات والمقالات (الإطار الأزرق الرمادي لويكيبيديا) */}
          <section className="border border-[#c8ccd1] bg-white rounded-xs overflow-hidden">
            <div className="bg-[#eaecf0] border-b border-[#c8ccd1] px-3.5 py-2 flex items-center justify-between">
              <h2 className="wiki-title text-[18px] leading-[1.35] font-bold text-[#202122] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#202122]" aria-hidden="true" />
                <span>أحدث المقالات والتحديثات</span>
              </h2>
              <a
                href={getDirectoryPath()}
                onClick={(e) => {
                  if (shouldHandleClientNavigation(e)) {
                    e.preventDefault();
                    onOpenDirectory();
                  }
                }}
                className="text-xs leading-[1.5] text-[#3366cc] hover:underline"
              >
                عرض الكل
              </a>
            </div>

            <div className="divide-y divide-[#eaecf0] text-[13.5px] leading-[1.55]">
              {recentlyUpdated.map((art) => (
                <div
                  key={art.id}
                  className="px-3.5 py-3 flex items-center justify-between gap-3 hover:bg-[#f8f9fa]"
                >
                  <div className="min-w-0">
                    <a
                      href={getArticlePath(art.id)}
                      onClick={(e) => {
                        if (shouldHandleClientNavigation(e)) {
                          e.preventDefault();
                          onOpenArticle(art.id);
                        }
                      }}
                      className="font-bold text-[13.5px] leading-[1.45] text-[#3366cc] hover:underline text-right truncate block"
                    >
                      {art.name}
                    </a>
                    <div className="text-xs leading-[1.5] text-[#54595d] truncate mt-0.5">
                      {art.portal} · {art.field}
                    </div>
                  </div>
                  <span className="font-mono-tabular text-xs leading-[1.5] text-[#54595d] shrink-0">
                    {art.updatedAt}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 3. دعوة المشاركة على طراز ويكيبيديا */}
          <section className="border border-[#a2a9b1] bg-[#f8f9fa] rounded-xs p-4 space-y-2.5 text-[13.5px] leading-[1.65]">
            <h2 className="wiki-title text-[17px] leading-[1.35] font-bold text-[#202122]">
              شارك في توثيق الذاكرة الفيلية
            </h2>
            <p className="text-[#54595d] leading-[1.65]">
              تعتمد موسوعة {settings.siteName} على مساهمات الباحثين والكتّاب في توثيق السير
              والعشائر والأماكن والفنون، وتخضع المساهمات لمراجعة الأعضاء لضمان الدقة.
            </p>
            <div className="pt-1 flex items-center gap-3 text-[13px] leading-[1.5]">
              <button
                type="button"
                onClick={onOpenNewArticle}
                className="text-[#3366cc] font-bold hover:underline cursor-pointer"
              >
                + أنشئ مقالة جديدة
              </button>
              <span className="text-[#a2a9b1]">·</span>
              <a
                href={getDirectoryPath()}
                onClick={(e) => {
                  if (shouldHandleClientNavigation(e)) {
                    e.preventDefault();
                    onOpenDirectory();
                  }
                }}
                className="text-[#3366cc] hover:underline"
              >
                تصفح الفهرس
              </a>
            </div>
          </section>
        </div>
      </div>

      {/* شريط التصنيفات الرئيسية والفرعية أسفل الصفحة الرئيسية (روابط SEO مستقلة) */}
      <section className="border border-[#a2a9b1] bg-[#f8f9fa] rounded-xs p-3.5 text-xs space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-[#202122] inline-flex items-center gap-1.5 ml-1">
            <FolderTree className="w-3.5 h-3.5 text-[#3366cc]" aria-hidden="true" />
            <span>تصنيفات الموسوعة:</span>
          </span>
          {topCategories.map(([cat, count], idx) => (
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
                {cat} <span className="font-mono-tabular">({count})</span>
              </a>
              {idx < topCategories.length - 1 && (
                <span className="text-[#a2a9b1]">·</span>
              )}
            </React.Fragment>
          ))}
        </div>

        {topSubcategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[#eaecf0] pt-2.5">
            <span className="font-bold text-[#14866d] inline-flex items-center gap-1.5 ml-1">
              <span>التصنيفات الفرعية:</span>
            </span>
            {topSubcategories.map(([sub, count], idx) => (
              <React.Fragment key={sub}>
                <a
                  href={getSubcategoryPath(sub)}
                  onClick={(e) => {
                    if (shouldHandleClientNavigation(e)) {
                      e.preventDefault();
                      onSelectSubcategory(sub);
                    }
                  }}
                  className="text-[#14866d] hover:underline"
                >
                  {sub} <span className="font-mono-tabular">({count})</span>
                </a>
                {idx < topSubcategories.length - 1 && (
                  <span className="text-[#a2a9b1]">·</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
