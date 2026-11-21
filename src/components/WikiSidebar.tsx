import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  Compass,
  FolderTree,
  GitBranch,
  Library,
  List,
  Users
} from 'lucide-react';
import {
  Article,
  WIKI_PORTALS,
  WikiPortal,
  getEffectiveSubcategories
} from '../types/encyclopedia';
import {
  getArticlePath,
  getCategoryPath,
  getDirectoryPath,
  getPortalPath,
  getSubcategoryPath,
  shouldHandleClientNavigation
} from '../utils/routes';
import { buildArticleToc, scrollToTocAnchor } from '../utils/toc';
import { PublicPage } from './Header';

interface WikiSidebarProps {
  activePage: PublicPage;
  articles: Article[];
  currentArticle: Article | null;
  selectedPortal: WikiPortal | 'الكل';
  selectedCategory: string;
  selectedSubcategory: string;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onNavigate: (page: PublicPage) => void;
  onSelectPortal: (portal: WikiPortal | 'الكل') => void;
  onSelectCategory: (cat: string) => void;
  onSelectSubcategory: (sub: string) => void;
  onSelectArticle: (id: string) => void;
}

export function WikiSidebar({
  activePage,
  articles,
  currentArticle,
  selectedPortal,
  selectedCategory,
  selectedSubcategory,
  isMobileOpen,
  onCloseMobile,
  onNavigate,
  onSelectPortal,
  onSelectCategory,
  onSelectSubcategory,
  onSelectArticle
}: WikiSidebarProps) {
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const art of articles) {
      for (const cat of art.categories) {
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [articles]);

  const subcategories = useMemo(() => {
    const base =
      selectedCategory === 'الكل'
        ? articles
        : articles.filter((a) => a.categories.includes(selectedCategory));
    const counts = new Map<string, number>();
    for (const art of base) {
      for (const sub of getEffectiveSubcategories(art)) {
        counts.set(sub, (counts.get(sub) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [articles, selectedCategory]);

  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
      const matchPortal = selectedPortal === 'الكل' || a.portal === selectedPortal;
      const matchCat =
        selectedCategory === 'الكل' || a.categories.includes(selectedCategory);
      const matchSub =
        selectedSubcategory === 'الكل' ||
        getEffectiveSubcategories(a).includes(selectedSubcategory);
      return matchPortal && matchCat && matchSub;
    });
  }, [articles, selectedPortal, selectedCategory, selectedSubcategory]);

  const articleToc = useMemo(
    () => (activePage === 'article' && currentArticle ? buildArticleToc(currentArticle) : null),
    [activePage, currentArticle]
  );

  const [activeAnchorId, setActiveAnchorId] = useState<string>('sec-intro');

  useEffect(() => {
    if (!articleToc || typeof IntersectionObserver === 'undefined') return;
    setActiveAnchorId('sec-intro');

    const elements = articleToc.allAnchorIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target?.id) {
          setActiveAnchorId(visible[0].target.id);
        }
      },
      {
        rootMargin: '-84px 0px -65% 0px',
        threshold: 0
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [articleToc]);

  const handleTocLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    anchorId: string
  ) => {
    if (shouldHandleClientNavigation(e)) {
      e.preventDefault();
      setActiveAnchorId(anchorId);
      scrollToTocAnchor(anchorId, true);
      onCloseMobile();
    }
  };

  return (
    <>
      <aside
        className={`fixed inset-y-0 right-0 z-30 w-60 bg-[#f8f9fa] lg:bg-transparent border-l border-[#eaecf0] lg:border-none transform transition-transform duration-200 ease-in-out pt-20 lg:pt-6 px-4 pb-10 shrink-0 overflow-y-auto lg:sticky lg:top-14 lg:self-start lg:max-h-[calc(100vh-3.5rem)] lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* فهرس محتويات الصفحة الحالية في أعلى الشريط الجانبي عند قراءة المقال (Vector 2022) */}
        {activePage === 'article' && currentArticle && articleToc && articleToc.items.length > 0 && (
          <div className="mb-6 bg-[#f8f9fa] lg:bg-transparent p-3 lg:p-0 rounded border lg:border-none border-[#eaecf0]">
            <div className="flex items-center justify-between border-b border-[#eaecf0] pb-1.5 mb-2.5">
              <h2 className="text-xs font-bold text-[#202122] flex items-center gap-1.5">
                <List className="w-3.5 h-3.5 text-[#54595d]" aria-hidden="true" />
                <span>فهرس المحتويات</span>
              </h2>
              <span className="font-mono-tabular text-[11px] text-[#54595d]">
                {articleToc.items.length}
              </span>
            </div>
            <nav aria-label="محتويات الصفحة" className="space-y-1 text-xs">
              <a
                href="#sec-intro"
                aria-current={activeAnchorId === 'sec-intro' ? 'location' : undefined}
                onClick={(e) => handleTocLinkClick(e, 'sec-intro')}
                className={`block py-1 px-2 rounded transition ${
                  activeAnchorId === 'sec-intro'
                    ? 'bg-[#eaf3ff] text-[#202122] font-bold'
                    : 'text-[#3366cc] hover:bg-[#eaf3ff] hover:underline'
                }`}
              >
                المقدمة
              </a>
              {articleToc.items.map((item) => (
                <div key={item.id} className="space-y-0.5">
                  <a
                    href={`#${item.id}`}
                    aria-current={activeAnchorId === item.id ? 'location' : undefined}
                    onClick={(e) => handleTocLinkClick(e, item.id)}
                    className={`flex items-baseline gap-1.5 py-1 px-2 rounded transition ${
                      activeAnchorId === item.id
                        ? 'bg-[#eaf3ff] text-[#202122] font-bold'
                        : 'text-[#3366cc] hover:bg-[#eaf3ff] hover:underline'
                    }`}
                  >
                    <span className="font-mono-tabular text-[11px] text-[#54595d] shrink-0">
                      {item.number}.
                    </span>
                    <span className="leading-snug">{item.title}</span>
                  </a>
                  {item.children.length > 0 && (
                    <div className="pr-4 space-y-0.5">
                      {item.children.map((sub) => (
                        <a
                          key={sub.id}
                          href={`#${sub.id}`}
                          aria-current={activeAnchorId === sub.id ? 'location' : undefined}
                          onClick={(e) => handleTocLinkClick(e, sub.id)}
                          className={`flex items-baseline gap-1.5 py-0.5 px-2 rounded text-[11px] transition ${
                            sub.level === 4 ? 'pr-4' : ''
                          } ${
                            activeAnchorId === sub.id
                              ? 'bg-[#eaf3ff] text-[#202122] font-bold'
                              : 'text-[#3366cc] hover:bg-[#eaf3ff] hover:underline'
                          }`}
                        >
                          <span className="font-mono-tabular text-[10px] text-[#54595d] shrink-0">
                            {sub.number}
                          </span>
                          <span className="leading-snug">{sub.title}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <a
                href={`#${articleToc.referencesItem.id}`}
                aria-current={
                  activeAnchorId === articleToc.referencesItem.id ? 'location' : undefined
                }
                onClick={(e) => handleTocLinkClick(e, articleToc.referencesItem.id)}
                className={`flex items-baseline gap-1.5 py-1 px-2 rounded transition ${
                  activeAnchorId === articleToc.referencesItem.id
                    ? 'bg-[#eaf3ff] text-[#202122] font-bold'
                    : 'text-[#3366cc] hover:bg-[#eaf3ff] hover:underline'
                }`}
              >
                <span className="font-mono-tabular text-[11px] text-[#54595d] shrink-0">
                  {articleToc.referencesItem.number}.
                </span>
                <span>{articleToc.referencesItem.title}</span>
              </a>
            </nav>
          </div>
        )}

        {/* بوابات ويكي فيلي */}
        <nav aria-label="بوابات ويكي فيلي" className="mb-6">
          <div className="border-b border-[#eaecf0] pb-1.5 mb-2">
            <h2 className="text-xs font-bold text-[#54595d] flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" aria-hidden="true" />
              بوابات ويكي فيلي
            </h2>
          </div>
          <ul className="space-y-1 text-xs">
            <li>
              <a
                href={getDirectoryPath()}
                onClick={(e) => {
                  if (shouldHandleClientNavigation(e)) {
                    e.preventDefault();
                    onSelectPortal('الكل');
                    onNavigate('directory');
                    onCloseMobile();
                  }
                }}
                className={`w-full text-right px-2 py-1 rounded transition flex items-center justify-between ${
                  activePage === 'directory' &&
                  selectedPortal === 'الكل' &&
                  selectedCategory === 'الكل' &&
                  selectedSubcategory === 'الكل'
                    ? 'bg-[#eaf3ff] text-[#3366cc] font-bold'
                    : 'text-[#3366cc] hover:underline'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Library className="w-3 h-3" aria-hidden="true" />
                  <span>فهرس جميع المقالات</span>
                </span>
                <span className="font-mono-tabular text-[11px] text-[#54595d]">
                  {articles.length}
                </span>
              </a>
            </li>
            {WIKI_PORTALS.map((portal) => {
              const count = articles.filter((a) => a.portal === portal.id).length;
              const isActive =
                activePage === 'directory' && selectedPortal === portal.id;
              return (
                <li key={portal.id}>
                  <a
                    href={getPortalPath(portal.id)}
                    onClick={(e) => {
                      if (shouldHandleClientNavigation(e)) {
                        e.preventDefault();
                        onSelectPortal(portal.id);
                        onCloseMobile();
                      }
                    }}
                    className={`w-full text-right px-2 py-1 rounded transition flex items-center justify-between ${
                      isActive
                        ? 'bg-[#eaf3ff] text-[#3366cc] font-bold'
                        : 'text-[#3366cc] hover:underline'
                    }`}
                  >
                    <span className="truncate">{portal.shortLabel}</span>
                    <span className="font-mono-tabular text-[11px] text-[#54595d]">
                      {count}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* تصنيفات الموسوعة */}
        <nav aria-label="التصنيفات الموضوعية" className="mb-6">
          <div className="border-b border-[#eaecf0] pb-1.5 mb-2.5">
            <h2 className="text-xs font-bold text-[#54595d] flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5" aria-hidden="true" />
              التصنيفات الموضوعية
            </h2>
          </div>
          <ul className="space-y-1 text-xs">
            <li>
              <a
                href={getDirectoryPath()}
                onClick={(e) => {
                  if (shouldHandleClientNavigation(e)) {
                    e.preventDefault();
                    onSelectCategory('الكل');
                    onCloseMobile();
                  }
                }}
                className={`w-full text-right px-2 py-1 rounded transition flex items-center justify-between ${
                  selectedCategory === 'الكل' &&
                  selectedSubcategory === 'الكل' &&
                  activePage === 'directory'
                    ? 'bg-[#eaf3ff] text-[#3366cc] font-bold'
                    : 'text-[#3366cc] hover:underline'
                }`}
              >
                <span>جميع التصنيفات</span>
                {selectedCategory === 'الكل' && selectedSubcategory === 'الكل' && (
                  <ChevronLeft className="w-3.5 h-3.5" />
                )}
              </a>
            </li>
            {categories.slice(0, 10).map(([cat, count]) => {
              const isActive = selectedCategory === cat;
              return (
                <li key={cat}>
                  <a
                    href={getCategoryPath(cat)}
                    onClick={(e) => {
                      if (shouldHandleClientNavigation(e)) {
                        e.preventDefault();
                        onSelectCategory(cat);
                        onCloseMobile();
                      }
                    }}
                    className={`w-full text-right px-2 py-1 rounded transition flex items-center justify-between ${
                      isActive
                        ? 'bg-[#eaf3ff] text-[#3366cc] font-bold'
                        : 'text-[#3366cc] hover:underline'
                    }`}
                  >
                    <span className="truncate">
                      {cat} ({count})
                    </span>
                    {isActive && <ChevronLeft className="w-3.5 h-3.5 shrink-0" />}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* التصنيفات الفرعية */}
        {subcategories.length > 0 && (
          <nav aria-label="التصنيفات الفرعية" className="mb-6">
            <div className="border-b border-[#eaecf0] pb-1.5 mb-2.5 flex items-center justify-between">
              <h2 className="text-xs font-bold text-[#54595d] flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-[#14866d]" aria-hidden="true" />
                التصنيفات الفرعية
              </h2>
              <span className="font-mono-tabular text-[11px] text-[#54595d]">
                {subcategories.length}
              </span>
            </div>
            <ul className="space-y-1 text-xs">
              {selectedSubcategory !== 'الكل' && (
                <li>
                  <a
                    href={
                      selectedCategory !== 'الكل'
                        ? getCategoryPath(selectedCategory)
                        : getDirectoryPath()
                    }
                    onClick={(e) => {
                      if (shouldHandleClientNavigation(e)) {
                        e.preventDefault();
                        onSelectSubcategory('الكل');
                        onCloseMobile();
                      }
                    }}
                    className="w-full text-right px-2 py-1 rounded transition flex items-center justify-between text-[#54595d] hover:text-[#14866d] hover:underline"
                  >
                    <span>كل التصنيفات الفرعية</span>
                  </a>
                </li>
              )}
              {subcategories.slice(0, 12).map(([sub, count]) => {
                const isActive = selectedSubcategory === sub;
                return (
                  <li key={sub}>
                    <a
                      href={getSubcategoryPath(sub, 'الكل', selectedCategory)}
                      onClick={(e) => {
                        if (shouldHandleClientNavigation(e)) {
                          e.preventDefault();
                          onSelectSubcategory(sub);
                          onCloseMobile();
                        }
                      }}
                      className={`w-full text-right px-2 py-1 rounded transition flex items-center justify-between ${
                        isActive
                          ? 'bg-[#e8f5f1] text-[#14866d] font-bold'
                          : 'text-[#14866d] hover:underline'
                      }`}
                    >
                      <span className="truncate">
                        {sub} ({count})
                      </span>
                      {isActive && <ChevronLeft className="w-3.5 h-3.5 shrink-0" />}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        {/* قائمة مقالات الموسوعة */}
        <nav aria-label="مقالات الموسوعة">
          <div className="border-b border-[#eaecf0] pb-1.5 mb-2.5 flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#54595d] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" aria-hidden="true" />
              مقالات الموسوعة
            </h2>
            <span className="font-mono-tabular text-[11px] bg-[#eaecf0] px-1.5 rounded text-[#202122] font-semibold">
              {filteredArticles.length}
            </span>
          </div>
          <ul className="space-y-1 text-xs">
            {filteredArticles.map((art) => {
              const isCurrent =
                activePage === 'article' && currentArticle?.id === art.id;
              return (
                <li key={art.id}>
                  <a
                    href={getArticlePath(art.id)}
                    onClick={(e) => {
                      if (shouldHandleClientNavigation(e)) {
                        e.preventDefault();
                        onSelectArticle(art.id);
                        onCloseMobile();
                      }
                    }}
                    className={`w-full text-right px-2 py-1 rounded transition flex items-center justify-between gap-1.5 ${
                      isCurrent
                        ? 'bg-[#eaf3ff] text-[#202122] font-bold border-r-2 border-[#3366cc]'
                        : 'text-[#3366cc] hover:underline'
                    }`}
                  >
                    <span className="truncate">{art.name}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          aria-hidden="true"
        />
      )}
    </>
  );
}
