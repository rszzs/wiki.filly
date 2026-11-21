import { useEffect, useMemo, useRef, useState } from 'react';
import { FilePlus2, Menu, Moon, Search, Sun, X } from 'lucide-react';
import {
  Article,
  SystemSettings,
  getEffectiveSubcategories,
  getPlaceLocationSummary,
  inferArticleType
} from '../types/encyclopedia';
import {
  getArticlePath,
  getHomePath,
  shouldHandleClientNavigation
} from '../utils/routes';
import { PortraitMedallion } from './PortraitMedallion';

export type PublicPage = 'home' | 'directory' | 'article';

interface HeaderProps {
  articles: Article[];
  settings: SystemSettings;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigateHome: () => void;
  onSelectArticle: (articleId: string) => void;
  onOpenNewArticle: () => void;
  onToggleMobileSidebar: () => void;
}

export function Header({
  articles,
  settings,
  isDarkMode,
  onToggleDarkMode,
  onNavigateHome,
  onSelectArticle,
  onOpenNewArticle,
  onToggleMobileSidebar
}: HeaderProps) {
  const [query, setQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const trimmedQuery = query.trim();

  const searchResults = useMemo(() => {
    if (!trimmedQuery) return [];
    const q = trimmedQuery.toLowerCase();
    return articles.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.subtitle.toLowerCase().includes(q) ||
        a.portal.toLowerCase().includes(q) ||
        a.field.toLowerCase().includes(q) ||
        a.birthplace.toLowerCase().includes(q) ||
        (a.geographicLocation ?? '').toLowerCase().includes(q) ||
        (a.administrativeRegion ?? '').toLowerCase().includes(q) ||
        (a.clanAffiliation ?? '').toLowerCase().includes(q) ||
        (a.historicalEra ?? '').toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.categories.some((c) => c.toLowerCase().includes(q)) ||
        getEffectiveSubcategories(a).some((s) => s.toLowerCase().includes(q))
    );
  }, [articles, trimmedQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#eaecf0]">
      <div className="max-w-[1440px] mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* اليمين: زر القائمة الجانبية + شعار ويكي فيلي (يرجع للرئيسية عند النقر) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="p-2 rounded hover:bg-[#f8f9fa] text-[#202122] lg:hidden cursor-pointer"
            title="القائمة الجانبية"
            aria-label="فتح القائمة الجانبية"
          >
            <Menu className="w-5 h-5" />
          </button>

          <a
            href={getHomePath()}
            onClick={(e) => {
              if (shouldHandleClientNavigation(e)) {
                e.preventDefault();
                onNavigateHome();
              }
            }}
            className="flex items-center gap-3 group text-right"
            title={settings.siteName}
          >
            <div className="w-10 h-10 rounded-full bg-[#f8f9fa] border border-[#a2a9b1] flex items-center justify-center shadow-inner relative overflow-hidden shrink-0">
              <svg viewBox="0 0 64 64" className="w-8 h-8" aria-hidden="true">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="#3366cc"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
                <path
                  d="M32 6 L35 24 L53 20 L38 31 L50 46 L32 37 L14 46 L26 31 L11 20 L29 24 Z"
                  fill="#eab308"
                  opacity="0.85"
                  className="h-auto w-auto text-[28px] leading-[32px]"
                />
                <text
                  x="32"
                  y="38"
                  fontFamily="Amiri, serif"
                  fontSize="22"
                  fontWeight="bold"
                  fill="#202122"
                  className="wiki-logo-letter"
                  textAnchor="middle"
                >
                  و
                </text>
              </svg>
            </div>
            <div className="leading-tight">
              <div className="font-editorial text-xl sm:text-2xl font-bold text-[#202122] tracking-tight group-hover:text-[#3366cc] transition whitespace-nowrap h-[33.9875px]">
                {settings.siteName}
              </div>
              <div className="text-[11px] text-[#54595d] hidden sm:block whitespace-nowrap">
                {settings.siteSubtitle}
              </div>
            </div>
          </a>
        </div>

        {/* الوسط: شريط البحث على طراز ويكيبيديا */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-xl">
          <div className="relative flex items-center">
            <Search
              className="w-4 h-4 text-[#54595d] absolute right-3 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => {
                if (trimmedQuery) setIsDropdownOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchResults.length > 0) {
                  onSelectArticle(searchResults[0].id);
                  setIsDropdownOpen(false);
                  setQuery('');
                }
              }}
              placeholder="ابحث في ويكي فيلي..."
              aria-label="ابحث في ويكي فيلي"
              className="w-full pr-9 pl-9 py-1.5 text-sm bg-white border border-[#a2a9b1] rounded-xs focus:outline-none focus:border-[#3366cc] focus:ring-1 focus:ring-[#3366cc] transition"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setIsDropdownOpen(false);
                }}
                aria-label="مسح البحث"
                className="absolute left-2.5 p-1 text-[#54595d] hover:text-[#202122] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* قائمة نتائج البحث الفوري */}
          {isDropdownOpen && trimmedQuery && (
            <div
              role="listbox"
              aria-label="نتائج البحث الفوري"
              className="absolute right-0 left-0 mt-1 bg-white border border-[#a2a9b1] rounded-xs shadow-lg z-50 max-h-80 overflow-y-auto divide-y divide-[#eaecf0]"
            >
              {searchResults.length === 0 ? (
                <div className="p-3 text-xs text-[#54595d] flex items-center justify-between gap-2">
                  <span>
                    لا توجد نتائج مطابقة لعبارة «
                    <strong className="text-[#202122]">{trimmedQuery}</strong>»
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenNewArticle();
                    }}
                    className="text-[#3366cc] font-bold hover:underline whitespace-nowrap cursor-pointer"
                  >
                    + أنشئ هذه الصفحة
                  </button>
                </div>
              ) : (
                searchResults.map((m) => {
                  const mType = inferArticleType(m);
                  const extraDetail =
                    mType === 'place'
                      ? getPlaceLocationSummary(m)
                      : mType === 'person'
                        ? m.birthplace
                        : m.field;
                  return (
                    <a
                      key={m.id}
                      href={getArticlePath(m.id)}
                      role="option"
                      aria-selected={false}
                      onClick={(e) => {
                        if (shouldHandleClientNavigation(e)) {
                          e.preventDefault();
                          onSelectArticle(m.id);
                          setIsDropdownOpen(false);
                          setQuery('');
                        }
                      }}
                      className="w-full text-right p-2.5 hover:bg-[#eaf3ff] transition flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PortraitMedallion
                          articleId={m.id}
                          initials={m.initials}
                          name={m.name}
                          tone={m.accentTone}
                          imageUrl={m.imageUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-[#3366cc] truncate">{m.name}</div>
                          <div className="text-xs text-[#54595d] line-clamp-1">
                            {m.subtitle}
                            {extraDetail ? ` — ${extraDetail}` : ''}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] bg-[#f8f9fa] border border-[#eaecf0] px-2 py-0.5 rounded shrink-0 text-[#54595d]">
                        {m.portal}
                      </span>
                    </a>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* اليسار: مفتاح تبديل الوضع الليلي + زر إضافة مقال جديد */}
        <div className="flex items-center gap-2.5 shrink-0 text-xs">
          <button
            type="button"
            role="switch"
            aria-checked={isDarkMode}
            onClick={onToggleDarkMode}
            aria-label={
              isDarkMode
                ? 'إيقاف وضع القراءة الليلي والعودة للوضع النهاري'
                : 'تفعيل وضع القراءة الليلي'
            }
            title={
              isDarkMode
                ? 'وضع القراءة الليلي مفعّل — انقر للعودة للوضع النهاري'
                : 'تفعيل وضع القراءة الليلي (Dark Mode)'
            }
            className="inline-flex items-center gap-2 px-2 py-1 rounded-xs border border-[#a2a9b1] bg-[#f8f9fa] hover:bg-[#eaf3ff] text-[#202122] transition cursor-pointer shrink-0"
          >
            <span
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                isDarkMode ? 'bg-[#3366cc]' : 'bg-[#c8ccd1]'
              }`}
              aria-hidden="true"
            >
              <span
                className={`night-toggle-thumb inline-flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-xs transition-transform duration-200 ${
                  isDarkMode ? '-translate-x-4.5' : '-translate-x-0.5'
                }`}
              >
                {isDarkMode ? (
                  <Moon className="w-2.5 h-2.5 text-[#3366cc]" />
                ) : (
                  <Sun className="w-2.5 h-2.5 text-[#ac6600]" />
                )}
              </span>
            </span>
            <span className="hidden md:inline font-semibold whitespace-nowrap">
              {isDarkMode ? 'الوضع الليلي' : 'وضع القراءة الليلي'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenNewArticle}
            className="px-3 py-1.5 text-[#3366cc] hover:bg-[#eaf3ff] border border-[#a2a9b1] rounded-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            title="إضافة مقال جديد في ويكي فيلي"
          >
            <FilePlus2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">إضافة مقال جديد</span>
          </button>
        </div>
      </div>

      {/* شريط إعلان عام اختياري */}
      {settings.announcementBanner.trim() && (
        <div className="bg-[#eaf3ff] border-t border-[#a2a9b1]/60 px-4 py-1.5 text-xs text-[#202122] text-center">
          {settings.announcementBanner}
        </div>
      )}
    </header>
  );
}
