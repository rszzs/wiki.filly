import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  LogIn,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  X
} from 'lucide-react';
import { ArticleTab, ArticleView } from './components/ArticleView';
import { DashboardView } from './components/DashboardView';
import { DirectoryView } from './components/DirectoryView';
import { Header, PublicPage } from './components/Header';
import { HomePageView } from './components/HomePageView';
import { NewArticleModal } from './components/NewArticleModal';
import { WikiSidebar } from './components/WikiSidebar';
import {
  DEFAULT_MEMBERS,
  DEFAULT_SYSTEM_SETTINGS,
  INITIAL_ARTICLES
} from './data/initialEncyclopedia';
import { auth, googleProvider } from './firebase';
import {
  addMemberInFirestore,
  addTalkMessageInFirestore,
  approveRevisionInFirestore,
  checkIsUserAdmin,
  createArticleInFirestore,
  createPendingRevisionInFirestore,
  deleteArticleInFirestore,
  migrateSupervisorNameInFirestore,
  publishArticleEditInFirestore,
  recordArticleMetricInFirestore,
  rejectRevisionInFirestore,
  removeMemberInFirestore,
  saveSystemSettingsInFirestore,
  seedInitialFirestoreDataIfEmpty,
  subscribeAdminArticleMetrics,
  subscribeAdminMembers,
  subscribeAdminReviewLog,
  subscribeArticleTalkMessages,
  subscribeGlobalSettings,
  subscribePendingRevisions,
  subscribePublicArticles,
  syncMissingBuiltInArticlesForAdmin,
  syncStateToFirestore,
  toggleMemberStatusInFirestore,
  updateArticleControlsInFirestore,
  updateArticleQuickTagsInFirestore,
  updateArticleStubStatusInFirestore
} from './services/firestoreEncyclopedia';
import {
  AccentTone,
  Article,
  ArticleMetricRecord,
  ArticleSnapshot,
  EncyclopediaState,
  MemberAccount,
  PendingRevision,
  ProtectionLevel,
  QuickEditorialTagKey,
  SystemSettings,
  TalkMessage,
  WikiPortal,
  getEffectiveSubcategories,
  inferArticleType
} from './types/encyclopedia';
import {
  getTodayDateKey,
  loadLocalArticleMetrics,
  mergeArticleMetrics,
  recordLocalArticleEvent
} from './utils/analytics';
import {
  getArticlePath,
  getCategoryPath,
  getDirectoryPath,
  getHomePath,
  getPortalPath,
  getSubcategoryPath,
  parseRouteFromLocation,
  pushRoutePath,
  shouldHandleClientNavigation
} from './utils/routes';
import { applySeoMetadata } from './utils/seo';
import {
  computeInitials,
  exportEncyclopediaJson,
  formatCurrentTimestamp,
  getDefaultState,
  validateAndParseImportJson,
  validateImageUrl
} from './utils/storage';

interface NoticeBanner {
  id: number;
  tone: 'success' | 'info' | 'error';
  message: string;
}

const INITIAL_KNOWN_CATEGORIES = Array.from(
  new Set(INITIAL_ARTICLES.flatMap((a) => a.categories))
);

const INITIAL_KNOWN_SUBCATEGORIES = Array.from(
  new Set(INITIAL_ARTICLES.flatMap((a) => getEffectiveSubcategories(a)))
);

export default function App() {
  // ---------------- حالة المصادقة (Firebase Auth) ----------------
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('wiki_feyli_theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    try {
      window.localStorage.setItem('wiki_feyli_theme', isDarkMode ? 'dark' : 'light');
    } catch {
      // ignore storage unavailability
    }
  }, [isDarkMode]);

  const handleToggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  // ---------------- حالة بيانات الموسوعة الحية من Firestore ----------------
  const [articles, setArticles] = useState<Article[]>(INITIAL_ARTICLES);
  const [articlesEmptyInDb, setArticlesEmptyInDb] = useState<boolean>(true);
  const [articlesLoadedFromDb, setArticlesLoadedFromDb] = useState<boolean>(false);
  const [pendingRevisions, setPendingRevisions] = useState<PendingRevision[]>([]);
  const [reviewLog, setReviewLog] = useState<PendingRevision[]>([]);
  const [members, setMembers] = useState<MemberAccount[]>(DEFAULT_MEMBERS);
  const [activeMemberName, setActiveMemberName] = useState<string>(
    DEFAULT_MEMBERS[0]?.name ?? 'رعد صباح (مدير التوثيق)'
  );
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [activeArticleTalkMessages, setActiveArticleTalkMessages] = useState<TalkMessage[]>([]);
  const [firestoreArticleMetrics, setFirestoreArticleMetrics] = useState<
    Record<string, ArticleMetricRecord>
  >({});
  const [localArticleMetrics, setLocalArticleMetrics] = useState<
    Record<string, ArticleMetricRecord>
  >(() => loadLocalArticleMetrics());
  const seedingAttemptedRef = useRef<boolean>(false);
  const supervisorRenameMigratedRef = useRef<boolean>(false);
  const lastTrackedViewRef = useRef<string>('');

  const mergedArticleMetrics = useMemo(
    () => mergeArticleMetrics(firestoreArticleMetrics, localArticleMetrics),
    [firestoreArticleMetrics, localArticleMetrics]
  );

  const trackArticleEvent = (articleId: string, kind: 'view' | 'interaction') => {
    if (!articleId) return;
    const dateKey = getTodayDateKey();
    const timestamp = formatCurrentTimestamp();
    const nextLocal = recordLocalArticleEvent(articleId, kind, dateKey, timestamp);
    setLocalArticleMetrics(nextLocal);
    if (firebaseUser?.emailVerified && !articlesEmptyInDb) {
      void recordArticleMetricInFirestore(articleId, kind, dateKey, timestamp);
    }
  };

  // ---------------- حالة التصفح والواجهة المهيّأة من المسار الحالي ----------------
  const initialRouteRef = useRef(
    parseRouteFromLocation(INITIAL_KNOWN_CATEGORIES, INITIAL_KNOWN_SUBCATEGORIES)
  );
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(
    () => initialRouteRef.current.kind === 'admin'
  );
  const [adminInspectingArticle, setAdminInspectingArticle] = useState<boolean>(false);
  const [publicPage, setPublicPage] = useState<PublicPage>(() => {
    const r = initialRouteRef.current;
    if (r.kind === 'article') return 'article';
    if (r.kind === 'directory') return 'directory';
    return 'home';
  });
  const [selectedArticleId, setSelectedArticleId] = useState<string>(() => {
    const r = initialRouteRef.current;
    if (r.kind === 'article') return r.articleId;
    return INITIAL_ARTICLES[0]?.id ?? '';
  });
  const [articleTab, setArticleTab] = useState<ArticleTab>(() => {
    const r = initialRouteRef.current;
    return r.kind === 'article' ? r.tab : 'read';
  });
  const [selectedPortal, setSelectedPortal] = useState<WikiPortal | 'الكل'>(() => {
    const r = initialRouteRef.current;
    return r.kind === 'directory' ? r.portal : 'الكل';
  });
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    const r = initialRouteRef.current;
    return r.kind === 'directory' ? r.category : 'الكل';
  });
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>(() => {
    const r = initialRouteRef.current;
    return r.kind === 'directory' ? r.subcategory : 'الكل';
  });
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [notice, setNotice] = useState<NoticeBanner | null>(null);

  const notify = (message: string, tone: 'success' | 'info' | 'error' = 'success') => {
    setNotice({ id: Date.now(), tone, message });
  };

  const allKnownCategories = useMemo(
    () => Array.from(new Set(articles.flatMap((a) => a.categories))),
    [articles]
  );

  const allKnownSubcategories = useMemo(
    () => Array.from(new Set(articles.flatMap((a) => getEffectiveSubcategories(a)))),
    [articles]
  );

  // مراقبة تغير المسار (/article/:id, /portal/:slug, /category/:slug, /subcategory/:slug, /directory, /admin)
  useEffect(() => {
    const syncRoute = () => {
      const parsed = parseRouteFromLocation(allKnownCategories, allKnownSubcategories);
      if (parsed.kind === 'admin') {
        setIsAdminRoute(true);
        return;
      }
      setIsAdminRoute(false);
      setAdminInspectingArticle(false);
      if (parsed.kind === 'article') {
        setSelectedArticleId(parsed.articleId);
        setArticleTab(parsed.tab);
        setPublicPage('article');
      } else if (parsed.kind === 'directory') {
        setSelectedPortal(parsed.portal);
        setSelectedCategory(parsed.category);
        setSelectedSubcategory(parsed.subcategory);
        setPublicPage('directory');
      } else {
        setPublicPage('home');
      }
    };
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash && !hash.startsWith('#/')) {
        return;
      }
      syncRoute();
    };
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [allKnownCategories, allKnownSubcategories]);

  // مطابقة اسم التصنيف الرئيسي والفرعي الدقيق عند اكتمال تحميل المقالات من Firestore
  useEffect(() => {
    if (
      isAdminRoute ||
      publicPage !== 'directory' ||
      (selectedCategory === 'الكل' && selectedSubcategory === 'الكل')
    ) {
      return;
    }
    const parsed = parseRouteFromLocation(allKnownCategories, allKnownSubcategories);
    if (parsed.kind === 'directory') {
      if (parsed.category !== selectedCategory) {
        setSelectedCategory(parsed.category);
      }
      if (parsed.subcategory !== selectedSubcategory) {
        setSelectedSubcategory(parsed.subcategory);
      }
    }
  }, [
    allKnownCategories,
    allKnownSubcategories,
    isAdminRoute,
    publicPage,
    selectedCategory,
    selectedSubcategory
  ]);

  // مؤقت إخفاء التنبيهات
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // مراقبة جلسة المستخدم وصلاحية الإدارة
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return;
      setFirebaseUser(user);
      setAuthError(null);
      if (user) {
        try {
          const adminFlag = await checkIsUserAdmin(user);
          if (!cancelled) {
            setIsAdmin(adminFlag);
            setAuthReady(true);
          }
        } catch {
          if (!cancelled) {
            setIsAdmin(false);
            setAuthReady(true);
          }
        }
      } else {
        setIsAdmin(false);
        setAuthReady(true);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // اشتراك القراءة العامة للمقالات والإعدادات
  useEffect(() => {
    const unsubArticles = subscribePublicArticles((docs, isEmpty) => {
      setArticlesEmptyInDb(isEmpty);
      setArticlesLoadedFromDb(true);
      if (isEmpty) {
        setArticles(INITIAL_ARTICLES);
      } else {
        setArticles(docs);
      }
    });
    const unsubSettings = subscribeGlobalSettings((nextSettings) => {
      setSettings(nextSettings);
    });
    return () => {
      unsubArticles();
      unsubSettings();
    };
  }, []);

  // تهيئة قاعدة البيانات بالبيانات الأولية أو المقالات الجديدة المضافة تلقائياً عند دخول المسؤول
  useEffect(() => {
    if (!authReady || !firebaseUser || !isAdmin || !articlesLoadedFromDb) return;

    const SYNC_STORAGE_KEY = 'wiki_feyli_builtin_sync_profiles_v2';

    if (articlesEmptyInDb) {
      if (seedingAttemptedRef.current) return;
      seedingAttemptedRef.current = true;

      seedInitialFirestoreDataIfEmpty(firebaseUser)
        .then((seeded) => {
          if (seeded) {
            try {
              window.localStorage.setItem(SYNC_STORAGE_KEY, '1');
            } catch {
              // ignore storage unavailability
            }
            notify('تمت تهيئة قاعدة بيانات ويكي فيلي السحابية بالمقالات والسير الذاتية المبدئية بنجاح.');
          }
        })
        .catch(() => {
          seedingAttemptedRef.current = false;
        });
      return;
    }

    let alreadySynced = false;
    try {
      alreadySynced = window.localStorage.getItem(SYNC_STORAGE_KEY) === '1';
    } catch {
      alreadySynced = false;
    }
    if (alreadySynced || seedingAttemptedRef.current) return;
    seedingAttemptedRef.current = true;

    const existingIds = articles.map((a) => a.id);
    syncMissingBuiltInArticlesForAdmin(existingIds)
      .then((syncedCount) => {
        try {
          window.localStorage.setItem(SYNC_STORAGE_KEY, '1');
        } catch {
          // ignore storage unavailability
        }
        if (syncedCount > 0) {
          notify(
            `تمت مزامنة ${syncedCount} سيرة ذاتية ومقالة موسوعية جديدة إلى قاعدة البيانات السحابية بنجاح.`
          );
        }
      })
      .catch(() => {
        seedingAttemptedRef.current = false;
      });
  }, [authReady, firebaseUser, isAdmin, articlesLoadedFromDb, articlesEmptyInDb, articles]);

  // تحديث اسم مدير التوثيق في سجلات Firestore القائمة تلقائياً عند دخول المشرف
  useEffect(() => {
    if (!authReady || !firebaseUser || !isAdmin || !articlesLoadedFromDb || articlesEmptyInDb) {
      return;
    }
    if (supervisorRenameMigratedRef.current) return;
    supervisorRenameMigratedRef.current = true;
    void migrateSupervisorNameInFirestore().catch(() => {
      supervisorRenameMigratedRef.current = false;
    });
  }, [authReady, firebaseUser, isAdmin, articlesLoadedFromDb, articlesEmptyInDb]);

  // اشتراك المراجعات المعلقة وسجل الإشراف والمشرفين وإحصائيات المقالات حسب الصلاحية
  useEffect(() => {
    if (!authReady) return;
    const unsubPending = subscribePendingRevisions(firebaseUser, isAdmin, setPendingRevisions);
    const unsubLog = subscribeAdminReviewLog(isAdmin, setReviewLog);
    const unsubMembers = subscribeAdminMembers(isAdmin, setMembers);
    const unsubMetrics = subscribeAdminArticleMetrics(isAdmin, setFirestoreArticleMetrics);
    return () => {
      unsubPending();
      unsubLog();
      unsubMembers();
      unsubMetrics();
    };
  }, [authReady, firebaseUser, isAdmin]);

  // تسجيل زيارة فعلية للمقالة عند قراءتها (مرة واحدة لكل انتقال إلى مقالة)
  useEffect(() => {
    const isReadingArticle =
      (!isAdminRoute && publicPage === 'article') ||
      (isAdminRoute && adminInspectingArticle);
    if (!isReadingArticle || !selectedArticleId) {
      lastTrackedViewRef.current = '';
      return;
    }
    const visitKey = `${selectedArticleId}:${isAdminRoute ? 'admin' : 'public'}`;
    if (lastTrackedViewRef.current === visitKey) return;
    lastTrackedViewRef.current = visitKey;

    const dateKey = getTodayDateKey();
    const timestamp = formatCurrentTimestamp();
    setLocalArticleMetrics(recordLocalArticleEvent(selectedArticleId, 'view', dateKey, timestamp));
    if (firebaseUser?.emailVerified && !articlesEmptyInDb) {
      void recordArticleMetricInFirestore(selectedArticleId, 'view', dateKey, timestamp);
    }
  }, [
    isAdminRoute,
    adminInspectingArticle,
    publicPage,
    selectedArticleId,
    firebaseUser,
    articlesEmptyInDb
  ]);

  // مزامنة اسم المشرف النشط عند تغير قائمة الأعضاء
  useEffect(() => {
    if (members.length === 0) return;
    const currentExists = members.some(
      (m) => m.name === activeMemberName && m.status === 'active'
    );
    if (!currentExists) {
      const firstActive = members.find((m) => m.status === 'active') ?? members[0];
      if (firstActive) {
        setActiveMemberName(firstActive.name);
      }
    }
  }, [members, activeMemberName]);

  const currentArticleBase = useMemo(() => {
    return articles.find((a) => a.id === selectedArticleId) ?? articles[0] ?? null;
  }, [articles, selectedArticleId]);

  // اشتراك رسائل النقاش للمقالة المفتوحة
  useEffect(() => {
    if (!currentArticleBase || articlesEmptyInDb) {
      setActiveArticleTalkMessages(currentArticleBase?.talkMessages ?? []);
      return;
    }
    const unsubTalk = subscribeArticleTalkMessages(
      currentArticleBase.id,
      setActiveArticleTalkMessages
    );
    return () => unsubTalk();
  }, [currentArticleBase?.id, articlesEmptyInDb]);

  const currentArticle = useMemo(() => {
    if (!currentArticleBase) return null;
    return {
      ...currentArticleBase,
      talkMessages: articlesEmptyInDb
        ? currentArticleBase.talkMessages
        : activeArticleTalkMessages
    };
  }, [currentArticleBase, articlesEmptyInDb, activeArticleTalkMessages]);

  const pendingForCurrentArticle = useMemo(() => {
    if (!currentArticle) return [];
    return pendingRevisions.filter((r) => r.articleId === currentArticle.id);
  }, [pendingRevisions, currentArticle]);

  const existingTitles = useMemo(() => articles.map((a) => a.name), [articles]);

  const directoryFilteredArticles = useMemo(() => {
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

  // تحديث وسوم SEO و OpenGraph و Canonical و Schema.org JSON-LD ديناميكياً لكل مسار
  useEffect(() => {
    if (isAdminRoute) {
      applySeoMetadata({ kind: 'admin' }, settings);
      return;
    }
    if (publicPage === 'article' && currentArticle) {
      applySeoMetadata({ kind: 'article', article: currentArticle }, settings);
      return;
    }
    if (publicPage === 'directory') {
      applySeoMetadata(
        {
          kind: 'directory',
          portal: selectedPortal,
          category: selectedCategory,
          subcategory: selectedSubcategory,
          filteredArticles: directoryFilteredArticles
        },
        settings
      );
      return;
    }
    applySeoMetadata({ kind: 'home', articles }, settings);
  }, [
    isAdminRoute,
    publicPage,
    currentArticle,
    selectedPortal,
    selectedCategory,
    selectedSubcategory,
    directoryFilteredArticles,
    articles,
    settings
  ]);

  // ---------------- دوال تسجيل الدخول والخروج عبر Google ----------------
  const handleSignInWithGoogle = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      notify('تم تسجيل الدخول بحساب Google بنجاح.');
    } catch (err) {
      const message =
        err instanceof Error && err.message.includes('popup-closed-by-user')
          ? 'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.'
          : 'تعذر إتمام تسجيل الدخول عبر Google. يرجى التحقق من السماح للنوافذ المنبثقة والمحاولة مرة أخرى.';
      setAuthError(message);
      notify(message, 'error');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setAdminInspectingArticle(false);
      notify('تم تسجيل الخروج من الحساب.', 'info');
    } catch {
      notify('حدث خطأ أثناء تسجيل الخروج.', 'error');
    }
  };

  const handleNavigateHome = () => {
    pushRoutePath(getHomePath());
    setIsAdminRoute(false);
    setAdminInspectingArticle(false);
    setPublicPage('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenDirectory = () => {
    setSelectedPortal('الكل');
    setSelectedCategory('الكل');
    setSelectedSubcategory('الكل');
    setPublicPage('directory');
    pushRoutePath(getDirectoryPath());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateExitAdmin = () => {
    handleNavigateHome();
  };

  const handleOpenArticle = (
    articleId: string,
    tab: ArticleTab = 'read',
    fromAdmin = false
  ) => {
    setSelectedArticleId(articleId);
    setArticleTab(tab);
    if (fromAdmin) {
      setAdminInspectingArticle(true);
    } else {
      setPublicPage('article');
      pushRoutePath(getArticlePath(articleId, tab));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleArticleTabChange = (tab: ArticleTab) => {
    setArticleTab(tab);
    if (!isAdminRoute && currentArticle) {
      pushRoutePath(getArticlePath(currentArticle.id, tab), true);
    }
  };

  const resolveWikiLinkHref = useMemo(() => {
    const aliasMap: Record<string, string> = {
      'بغداد': 'khanaqin-mandali-places',
      'محافظة ديالى': 'khanaqin-mandali-places',
      'محافظة واسط': 'khanaqin-mandali-places',
      'لهجة فيلية': 'hora-feyli-music-arts'
    };
    return (targetTitle: string): string | null => {
      const normalized = targetTitle.trim();
      const exactArticle = articles.find((a) => a.name === normalized);
      if (exactArticle) return getArticlePath(exactArticle.id);
      const aliasedId = aliasMap[normalized];
      if (aliasedId && articles.some((a) => a.id === aliasedId)) {
        return getArticlePath(aliasedId);
      }
      if (articles.some((a) => a.categories.includes(normalized))) {
        return getCategoryPath(normalized);
      }
      if (articles.some((a) => getEffectiveSubcategories(a).includes(normalized))) {
        return getSubcategoryPath(normalized);
      }
      return null;
    };
  }, [articles]);

  const handleWikiLinkClick = (targetTitle: string, fromAdmin = false) => {
    const normalized = targetTitle.trim();
    const exactArticle = articles.find((a) => a.name === normalized);
    if (exactArticle) {
      handleOpenArticle(exactArticle.id, 'read', fromAdmin);
      return;
    }

    const aliasMap: Record<string, string> = {
      'بغداد': 'khanaqin-mandali-places',
      'محافظة ديالى': 'khanaqin-mandali-places',
      'محافظة واسط': 'khanaqin-mandali-places',
      'لهجة فيلية': 'hora-feyli-music-arts'
    };
    const aliasedId = aliasMap[normalized];
    if (aliasedId && articles.some((a) => a.id === aliasedId)) {
      handleOpenArticle(aliasedId, 'read', fromAdmin);
      return;
    }

    if (!fromAdmin) {
      const matchingCategoryArticle = articles.find((a) =>
        a.categories.includes(normalized)
      );
      if (matchingCategoryArticle) {
        handleSelectGlobalCategory(normalized);
        return;
      }
      const matchingSubcategoryArticle = articles.find((a) =>
        getEffectiveSubcategories(a).includes(normalized)
      );
      if (matchingSubcategoryArticle) {
        handleSelectGlobalSubcategory(normalized);
        return;
      }
    }

    notify(
      `صفحة «${normalized}» غير منشأة بشكل مستقل بعد؛ يمكنك إضافتها من زر «أنشئ مقالة».`,
      'info'
    );
  };

  const handleSelectPortal = (portal: WikiPortal | 'الكل') => {
    setIsAdminRoute(false);
    setAdminInspectingArticle(false);
    setSelectedPortal(portal);
    setSelectedCategory('الكل');
    setSelectedSubcategory('الكل');
    setPublicPage('directory');
    pushRoutePath(getPortalPath(portal));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectGlobalCategory = (category: string) => {
    setIsAdminRoute(false);
    setAdminInspectingArticle(false);
    setSelectedPortal('الكل');
    setSelectedCategory(category);
    setSelectedSubcategory('الكل');
    setPublicPage('directory');
    pushRoutePath(getCategoryPath(category, 'الكل'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectDirectoryCategory = (category: string) => {
    setSelectedCategory(category);
    setSelectedSubcategory('الكل');
    setPublicPage('directory');
    pushRoutePath(getCategoryPath(category, selectedPortal));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectGlobalSubcategory = (subcategory: string) => {
    setIsAdminRoute(false);
    setAdminInspectingArticle(false);
    setSelectedPortal('الكل');
    setSelectedCategory('الكل');
    setSelectedSubcategory(subcategory);
    setPublicPage('directory');
    pushRoutePath(getSubcategoryPath(subcategory, 'الكل', 'الكل'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectDirectorySubcategory = (subcategory: string) => {
    setSelectedSubcategory(subcategory);
    setPublicPage('directory');
    pushRoutePath(getSubcategoryPath(subcategory, selectedPortal, selectedCategory));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---------------- عمليات الإدارة والمشرفين ----------------
  const handleChangeActiveMember = (memberName: string) => {
    setActiveMemberName(memberName);
    notify(`تم التبديل إلى حساب المشرف: ${memberName}`, 'info');
  };

  const handleAddMember = async ({
    name,
    roleTitle,
    specialty
  }: {
    name: string;
    roleTitle: string;
    specialty: string;
  }) => {
    if (!isAdmin) return;
    const newMember: MemberAccount = {
      id: `mem-${Date.now()}`,
      name,
      roleTitle,
      specialty,
      status: 'active',
      joinedAt: formatCurrentTimestamp().slice(0, 10)
    };
    try {
      await addMemberInFirestore(newMember);
      setActiveMemberName(newMember.name);
      notify(`تم إنشاء حساب «${name}» (${roleTitle}) في قاعدة البيانات بنجاح.`);
    } catch {
      notify('تعذر حفظ حساب المشرف الجديد في قاعدة البيانات.', 'error');
    }
  };

  const handleToggleMemberStatus = async (memberId: string) => {
    if (!isAdmin) return;
    const target = members.find((m) => m.id === memberId);
    if (!target) return;

    const activeCount = members.filter((m) => m.status === 'active').length;
    if (target.status === 'active' && activeCount <= 1) {
      notify('يجب الإبقاء على حساب إداري نشط واحد على الأقل.', 'error');
      return;
    }

    const nextStatus: 'active' | 'suspended' =
      target.status === 'active' ? 'suspended' : 'active';
    try {
      await toggleMemberStatusInFirestore(memberId, nextStatus);
      notify(
        nextStatus === 'suspended'
          ? `تم تعليق حساب «${target.name}» مؤقتاً.`
          : `تم تفعيل حساب «${target.name}».`,
        'info'
      );
    } catch {
      notify('تعذر تحديث حالة حساب المشرف.', 'error');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!isAdmin) return;
    if (members.length <= 1) {
      notify('لا يمكن حذف الحساب الوحيد في النظام.', 'error');
      return;
    }
    const target = members.find((m) => m.id === memberId);
    if (!target) return;

    try {
      await removeMemberInFirestore(memberId);
      notify(`تم حذف حساب «${target.name}».`, 'info');
    } catch {
      notify('تعذر حذف حساب المشرف من قاعدة البيانات.', 'error');
    }
  };

  const handleUpdateSettings = async (nextSettings: SystemSettings) => {
    if (!isAdmin) return;
    try {
      await saveSystemSettingsInFirestore(nextSettings);
      notify('تم حفظ إعدادات النظام العام لويكي فيلي في السحابة بنجاح.');
    } catch {
      notify('تعذر حفظ إعدادات النظام.', 'error');
    }
  };

  // ---------------- عمليات المساهمات والمقالات ----------------
  const handleSubmitEditProposal = async ({
    articleId,
    proposedData,
    author,
    summary,
    publishDirectly
  }: {
    articleId: string;
    proposedData: ArticleSnapshot;
    author: string;
    summary: string;
    publishDirectly: boolean;
  }) => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      notify('يرجى تسجيل الدخول بحساب Google الموثق لإرسال التعديل.', 'error');
      return;
    }

    const target = articles.find((a) => a.id === articleId);
    if (!target) return;

    if (articlesEmptyInDb) {
      if (!isAdmin) {
        notify(
          'بانتظار دخول المشرف العام لتهيئة أرشيف المقالات في قاعدة البيانات السحابية.',
          'info'
        );
        return;
      }
      try {
        await seedInitialFirestoreDataIfEmpty(firebaseUser);
        seedingAttemptedRef.current = true;
      } catch {
        notify('تعذر تهيئة أرشيف المقالات في قاعدة البيانات قبل حفظ التعديل.', 'error');
        return;
      }
    }

    const imageCheck = validateImageUrl(proposedData.imageUrl);
    if (settings.allowImageUrls && !imageCheck.valid) {
      notify(imageCheck.error ?? 'رابط الصورة غير صالح.', 'error');
      return;
    }

    const sanitizedProposedData: ArticleSnapshot = {
      ...proposedData,
      imageUrl: settings.allowImageUrls ? imageCheck.sanitized : (target.imageUrl ?? ''),
      imageCaption: settings.allowImageUrls
        ? (proposedData.imageCaption ?? '').trim()
        : (target.imageCaption ?? '')
    };

    const timestamp = formatCurrentTimestamp();
    const todayDate = timestamp.slice(0, 10);

    try {
      if (isAdmin && (publishDirectly || !settings.requireMemberApproval)) {
        const revId = `rev-${Date.now().toString().slice(-5)}`;
        const nextHistory = [
          ...target.history,
          {
            id: revId,
            timestamp,
            author,
            approver: activeMemberName,
            summary,
            status: 'approved' as const,
            snapshot: sanitizedProposedData
          }
        ];
        await publishArticleEditInFirestore(
          articleId,
          sanitizedProposedData,
          nextHistory,
          todayDate
        );
        trackArticleEvent(articleId, 'interaction');
        setArticleTab('read');
        notify('تم اعتماد ونشر التعديل على الصفحة في قاعدة البيانات بنجاح.');
        return;
      }

      const originalSnapshot: ArticleSnapshot = {
        name: target.name,
        subtitle: target.subtitle,
        portal: target.portal,
        articleType: inferArticleType(target),
        summary: target.summary,
        field: target.field,
        activeYears: target.activeYears,
        birthDate: target.birthDate ?? '',
        deathDate: target.deathDate ?? '',
        birthDeath: target.birthDeath,
        birthplace: target.birthplace,
        clanAffiliation: target.clanAffiliation ?? '',
        geographicLocation: target.geographicLocation ?? '',
        administrativeRegion: target.administrativeRegion ?? '',
        coordinates: target.coordinates ?? '',
        populationEstimate: target.populationEstimate ?? '',
        relatedClans: target.relatedClans ?? '',
        historicalEra: target.historicalEra ?? '',
        notableWorks: target.notableWorks,
        ...(target.infoboxRows ? { infoboxRows: target.infoboxRows } : {}),
        imageUrl: target.imageUrl ?? '',
        imageCaption: target.imageCaption ?? '',
        categories: target.categories,
        subcategories: getEffectiveSubcategories(target),
        ...(typeof target.isStub === 'boolean' ? { isStub: target.isStub } : {}),
        ...(typeof target.needsSources === 'boolean'
          ? { needsSources: target.needsSources }
          : {}),
        ...(typeof target.isFeatured === 'boolean' ? { isFeatured: target.isFeatured } : {}),
        sections: target.sections,
        references: target.references
      };

      const newPending: PendingRevision = {
        id: `pend-${Date.now().toString().slice(-5)}`,
        type: 'edit',
        articleId: target.id,
        articleName: sanitizedProposedData.name,
        author,
        summary,
        submittedAt: timestamp,
        status: 'pending',
        originalData: originalSnapshot,
        proposedData: sanitizedProposedData
      };

      await createPendingRevisionInFirestore(newPending, firebaseUser.uid);
      trackArticleEvent(articleId, 'interaction');
      setArticleTab('history');
      notify('تم إرسال مساهمتك إلى قاعدة البيانات! تخضع الآن لمراجعة الأعضاء المشرفين.');
    } catch {
      notify('تعذر حفظ المساهمة في قاعدة البيانات. يرجى المحاولة مرة أخرى.', 'error');
    }
  };

  const handleSubmitNewArticle = async ({
    snapshot,
    author,
    accentTone,
    designatedApprovers,
    protectionLevel,
    publishDirectly
  }: {
    snapshot: ArticleSnapshot;
    author: string;
    accentTone: AccentTone;
    designatedApprovers: string[];
    protectionLevel: ProtectionLevel;
    publishDirectly: boolean;
  }) => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      notify('يرجى تسجيل الدخول بحساب Google الموثق لإضافة مقالة جديدة.', 'error');
      return;
    }

    const imageCheck = validateImageUrl(snapshot.imageUrl);
    if (settings.allowImageUrls && !imageCheck.valid) {
      notify(imageCheck.error ?? 'رابط الصورة غير صالح.', 'error');
      return;
    }
    const sanitizedSnapshot: ArticleSnapshot = {
      ...snapshot,
      imageUrl: settings.allowImageUrls ? imageCheck.sanitized : ''
    };

    const timestamp = formatCurrentTimestamp();
    const newId = `entry-${Date.now()}`;

    try {
      if (isAdmin && (publishDirectly || !settings.requireMemberApproval)) {
        const newArticle: Article = {
          ...sanitizedSnapshot,
          id: newId,
          initials: computeInitials(sanitizedSnapshot.name),
          accentTone,
          updatedAt: timestamp.slice(0, 10),
          protectionLevel,
          designatedApprovers,
          talkMessages: [],
          history: [
            {
              id: `rev-${Date.now().toString().slice(-5)}`,
              timestamp,
              author,
              approver: activeMemberName,
              summary: 'إنشاء وتوثيق الصفحة وتفعيل لوحة تحكمها المستقلة',
              status: 'approved',
              snapshot: sanitizedSnapshot
            }
          ]
        };

        await createArticleInFirestore(newArticle);
        setSelectedArticleId(newId);
        setArticleTab('read');
        if (isAdminRoute) {
          setAdminInspectingArticle(true);
        } else {
          setPublicPage('article');
          pushRoutePath(getArticlePath(newId, 'read'));
        }
        notify(`تم إنشاء صفحة «${sanitizedSnapshot.name}» في بوابة ${sanitizedSnapshot.portal}.`);
        return;
      }

      const pendingNew: PendingRevision = {
        id: `pend-${Date.now().toString().slice(-5)}`,
        type: 'new_article',
        articleId: newId,
        articleName: sanitizedSnapshot.name,
        author,
        summary: `طلب تسجيل صفحة جديدة في بوابة ${sanitizedSnapshot.portal}`,
        submittedAt: timestamp,
        status: 'pending',
        proposedData: sanitizedSnapshot,
        accentTone,
        designatedApprovers,
        protectionLevel
      };

      await createPendingRevisionInFirestore(pendingNew, firebaseUser.uid);
      notify(
        `تم إرسال مقالة «${snapshot.name}» للمراجعة! ستظهر في بوابة ${snapshot.portal} فور موافقة الأعضاء المشرفين.`
      );
    } catch {
      notify('تعذر حفظ المقالة في قاعدة البيانات. يرجى المحاولة مرة أخرى.', 'error');
    }
  };

  const handleApproveRevision = async (revisionId: string) => {
    if (!isAdmin) return;
    const targetRev = pendingRevisions.find((r) => r.id === revisionId);
    if (!targetRev) return;

    const timestamp = formatCurrentTimestamp();
    const revEntryId = `rev-${Date.now().toString().slice(-5)}`;
    const existingArticle = articles.find((a) => a.id === targetRev.articleId);

    try {
      await approveRevisionInFirestore({
        revision: targetRev,
        existingArticle,
        approverName: activeMemberName,
        timestamp,
        revEntryId
      });

      if (targetRev.type === 'new_article') {
        setSelectedArticleId(targetRev.articleId);
      }

      notify(
        targetRev.type === 'new_article'
          ? `تمت الموافقة على تسجيل «${targetRev.articleName}» ونشرها بتوقيع (${activeMemberName}).`
          : `تم تأكيد الموافقة ونشر تعديلات «${targetRev.articleName}» بتوقيع (${activeMemberName}).`
      );
    } catch {
      notify('تعذر اعتماد المساهمة في قاعدة البيانات.', 'error');
    }
  };

  const handleRejectRevision = async (revisionId: string, reason: string) => {
    if (!isAdmin) return;
    const targetRev = pendingRevisions.find((r) => r.id === revisionId);
    if (!targetRev) return;

    try {
      await rejectRevisionInFirestore({
        revision: targetRev,
        reason,
        reviewedBy: activeMemberName,
        timestamp: formatCurrentTimestamp()
      });
      notify(
        `تم رفض مساهمة «${targetRev.articleName}» وتوثيق السبب في سجل الإشراف.`,
        'info'
      );
    } catch {
      notify('تعذر تسجيل رفض المساهمة.', 'error');
    }
  };

  const handleAddTalkMessage = async ({
    articleId,
    author,
    topic,
    text
  }: {
    articleId: string;
    author: string;
    topic: string;
    text: string;
  }) => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      notify('يرجى تسجيل الدخول بحساب Google الموثق لإضافة ملاحظة في صفحة النقاش.', 'error');
      return;
    }
    if (articlesEmptyInDb) {
      if (!isAdmin) {
        notify(
          'بانتظار دخول المشرف العام لتهيئة أرشيف المقالات في قاعدة البيانات السحابية.',
          'info'
        );
        return;
      }
      try {
        await seedInitialFirestoreDataIfEmpty(firebaseUser);
        seedingAttemptedRef.current = true;
      } catch {
        notify('تعذر تهيئة أرشيف المقالات في قاعدة البيانات قبل حفظ الملاحظة.', 'error');
        return;
      }
    }

    try {
      await addTalkMessageInFirestore({
        articleId,
        author,
        authorUid: firebaseUser.uid,
        role: isAdminRoute && isAdmin ? 'moderator' : 'visitor',
        topic,
        text,
        displayTimestamp: formatCurrentTimestamp()
      });
      trackArticleEvent(articleId, 'interaction');
      notify('تمت إضافة ملاحظتك إلى صفحة النقاش.');
    } catch {
      notify('تعذر حفظ الملاحظة في صفحة النقاش.', 'error');
    }
  };

  const handleUpdatePageControls = async ({
    articleId,
    portal,
    protectionLevel,
    designatedApprovers,
    imageUrl,
    imageCaption,
    categories,
    subcategories,
    isStub
  }: {
    articleId: string;
    portal: WikiPortal;
    protectionLevel: ProtectionLevel;
    designatedApprovers: string[];
    imageUrl: string;
    imageCaption: string;
    categories: string[];
    subcategories?: string[];
    isStub?: boolean;
  }) => {
    if (!isAdmin || !firebaseUser) return;

    if (articlesEmptyInDb) {
      try {
        await seedInitialFirestoreDataIfEmpty(firebaseUser);
        seedingAttemptedRef.current = true;
      } catch {
        notify('تعذر تهيئة أرشيف المقالات في قاعدة البيانات قبل حفظ الإعدادات.', 'error');
        return;
      }
    }

    const imageCheck = validateImageUrl(imageUrl);
    if (settings.allowImageUrls && !imageCheck.valid) {
      notify(imageCheck.error ?? 'رابط الصورة غير صالح.', 'error');
      return;
    }

    const todayDate = formatCurrentTimestamp().slice(0, 10);
    try {
      await updateArticleControlsInFirestore(articleId, {
        portal,
        protectionLevel,
        designatedApprovers,
        imageUrl: settings.allowImageUrls ? imageCheck.sanitized : '',
        imageCaption,
        categories,
        subcategories,
        isStub,
        updatedAt: todayDate
      });
      notify('تم حفظ إعدادات تحكم الصفحة والتصنيفات ووسم البذرة في قاعدة البيانات بنجاح.');
    } catch {
      notify('تعذر حفظ إعدادات تحكم الصفحة.', 'error');
    }
  };

  const handleToggleArticleStub = async (articleId: string, nextIsStub: boolean) => {
    if (!isAdmin || !firebaseUser) return;

    if (articlesEmptyInDb) {
      try {
        await seedInitialFirestoreDataIfEmpty(firebaseUser);
        seedingAttemptedRef.current = true;
      } catch {
        notify('تعذر تهيئة أرشيف المقالات قبل تحديث وسم البذرة.', 'error');
        return;
      }
    }

    const target = articles.find((a) => a.id === articleId);
    const todayDate = formatCurrentTimestamp().slice(0, 10);
    try {
      await updateArticleStubStatusInFirestore(articleId, nextIsStub, todayDate);
      notify(
        nextIsStub
          ? `تم وسم مقالة «${target?.name ?? ''}» كـ «بذرة» تحتاج إثراءً.`
          : `تمت إزالة وسم البذرة واعتماد «${target?.name ?? ''}» كمقالة مكتملة.`
      );
    } catch {
      notify('تعذر تحديث حالة وسم البذرة في قاعدة البيانات.', 'error');
    }
  };

  const handleQuickToggleArticleTag = async (
    articleId: string,
    tag: QuickEditorialTagKey,
    nextValue: boolean
  ) => {
    if (!isAdmin || !firebaseUser) return;

    if (articlesEmptyInDb) {
      try {
        await seedInitialFirestoreDataIfEmpty(firebaseUser);
        seedingAttemptedRef.current = true;
      } catch {
        notify('تعذر تهيئة أرشيف المقالات قبل تحديث الوسم السريع.', 'error');
        return;
      }
    }

    const target = articles.find((a) => a.id === articleId);
    const titleLabel = target?.name ? `«${target.name}»` : 'المقالة';
    const todayDate = formatCurrentTimestamp().slice(0, 10);

    try {
      await updateArticleQuickTagsInFirestore(articleId, { [tag]: nextValue }, todayDate);
      trackArticleEvent(articleId, 'interaction');

      const tagMessages: Record<QuickEditorialTagKey, { added: string; removed: string }> = {
        isStub: {
          added: `تم وسم ${titleLabel} كـ «بذرة» وحفظ الحالة في قاعدة البيانات.`,
          removed: `تمت إزالة وسم «بذرة» واعتماد ${titleLabel} كمقالة مكتملة.`
        },
        needsSources: {
          added: `تم وسم ${titleLabel} بأنها «بحاجة لمصادر» وحفظ الحالة في قاعدة البيانات.`,
          removed: `تمت إزالة وسم «بحاجة لمصادر» عن ${titleLabel}.`
        },
        isFeatured: {
          added: `تم اعتماد ${titleLabel} ضمن «المقالات المتميزة» في قاعدة البيانات.`,
          removed: `تمت إزالة وسم «مقالة متميزة» عن ${titleLabel}.`
        }
      };

      notify(nextValue ? tagMessages[tag].added : tagMessages[tag].removed);
    } catch {
      notify('تعذر تحديث وسم المقالة في قاعدة البيانات. يرجى المحاولة مجدداً.', 'error');
    }
  };

  const handleDeleteArticle = async (articleId: string) => {
    if (!isAdmin) return;
    if (articles.length <= 1) {
      notify('لا يمكن حذف الصفحة الوحيدة المتبقية في الموسوعة.', 'error');
      return;
    }
    const target = articles.find((a) => a.id === articleId);
    try {
      await deleteArticleInFirestore(articleId);
      if (isAdminRoute) {
        setAdminInspectingArticle(false);
      } else {
        setPublicPage('home');
        pushRoutePath(getHomePath());
      }
      notify(`تم حذف صفحة «${target?.name ?? ''}» من الفهرس.`, 'info');
    } catch {
      notify('تعذر حذف المقالة من قاعدة البيانات.', 'error');
    }
  };

  const handleImportJson = async (rawText: string) => {
    if (!isAdmin || !firebaseUser) return;
    const imported = validateAndParseImportJson(rawText);
    if (!imported) {
      notify('ملف JSON غير صالح أو لا يطابق بنية بيانات الموسوعة.', 'error');
      return;
    }
    try {
      await syncStateToFirestore(imported, firebaseUser.uid);
      setSelectedArticleId(imported.articles[0]?.id ?? '');
      notify(`تم استيراد ومزامنة ${imported.articles.length} صفحة إلى السحابة بنجاح.`);
    } catch {
      notify('تعذر استيراد البيانات إلى قاعدة البيانات.', 'error');
    }
  };

  const handleResetDefaults = async () => {
    if (!isAdmin || !firebaseUser) return;
    const defaults = getDefaultState();
    try {
      await syncStateToFirestore(defaults, firebaseUser.uid);
      setSelectedArticleId(defaults.articles[0]?.id ?? '');
      setSelectedPortal('الكل');
      setSelectedCategory('الكل');
      setSelectedSubcategory('الكل');
      notify('تمت استعادة البيانات الافتراضية لويكي فيلي في السحابة.', 'info');
    } catch {
      notify('تعذر استعادة البيانات الافتراضية.', 'error');
    }
  };

  const handleExportJson = () => {
    const snapshotState: EncyclopediaState = {
      version: 7,
      articles,
      pendingRevisions,
      reviewLog,
      members,
      activeMemberName,
      userRole: isAdmin ? 'moderator' : 'visitor',
      settings
    };
    exportEncyclopediaJson(snapshotState);
    notify('تم تصدير النسخة الاحتياطية الكاملة بصيغة JSON.');
  };

  const renderNotice = () =>
    notice && (
      <div
        role="status"
        className={`mb-5 p-3.5 rounded border-r-4 text-xs flex items-center justify-between shadow-2xs ${
          notice.tone === 'error'
            ? 'bg-red-50 border-[#d33] text-red-950'
            : notice.tone === 'info'
              ? 'bg-blue-50 border-[#3366cc] text-[#202122]'
              : 'bg-emerald-50 border-[#14866d] text-emerald-950'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {notice.tone === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#14866d]" />
          ) : (
            <Info className="w-4 h-4 shrink-0 text-[#3366cc]" />
          )}
          <span className="font-medium leading-relaxed">{notice.message}</span>
        </div>
        <button
          type="button"
          onClick={() => setNotice(null)}
          aria-label="إغلاق التنبيه"
          className="p-1 opacity-70 hover:opacity-100 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );

  // ---------------- واجهة الإدارة المستقلة (/admin) ----------------
  if (isAdminRoute) {
    if (!authReady) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] text-[#202122] p-4">
          <div className="bg-white border border-[#a2a9b1] rounded-md p-6 flex items-center gap-3 text-sm shadow-xs">
            <Loader2 className="w-5 h-5 animate-spin text-[#3366cc]" aria-hidden="true" />
            <span>جارٍ التحقق من جلسة الإدارة...</span>
          </div>
        </div>
      );
    }

    if (!firebaseUser) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] text-[#202122] p-4">
          <div className="max-w-md w-full bg-white border border-[#a2a9b1] rounded-md p-6 sm:p-7 space-y-5 shadow-xs">
            <div className="flex items-center gap-3 border-b border-[#eaecf0] pb-4">
              <div className="w-10 h-10 rounded bg-[#eaf3ff] border border-[#a7d7f9] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-[#3366cc]" aria-hidden="true" />
              </div>
              <div>
                <h1 className="wiki-title text-xl font-bold text-[#202122]">
                  تسجيل الدخول إلى لوحة الإدارة
                </h1>
                <p className="text-xs text-[#54595d]">
                  {settings.siteName} — بوابة الإشراف المستقلة (/admin)
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-[#54595d]">
              هذه البوابة مخصصة لهيئة الإشراف في ويكي فيلي لمراجعة المساهمات المعلقة وإدارة صفحات الموسوعة والأعضاء. يرجى تسجيل الدخول بحساب Google المعتمد.
            </p>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 text-[#d33] text-xs rounded flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{authError}</span>
              </div>
            )}

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handleSignInWithGoogle}
                disabled={isSigningIn}
                className="w-full py-2.5 px-4 bg-[#3366cc] hover:bg-[#2a4b8d] disabled:opacity-60 text-white text-sm font-bold rounded flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSigningIn ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <LogIn className="w-4 h-4" aria-hidden="true" />
                )}
                <span>
                  {isSigningIn ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول عبر Google'}
                </span>
              </button>

              <button
                type="button"
                onClick={navigateExitAdmin}
                className="w-full py-2 px-4 bg-white hover:bg-[#f8f9fa] text-[#202122] border border-[#a2a9b1] text-xs font-semibold rounded flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                <span>العودة إلى الواجهة العامة للموسوعة</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (!isAdmin) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] text-[#202122] p-4">
          <div className="max-w-md w-full bg-white border border-[#a2a9b1] rounded-md p-6 sm:p-7 space-y-5 shadow-xs">
            <div className="flex items-center gap-3 border-b border-[#eaecf0] pb-4">
              <div className="w-10 h-10 rounded bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-[#d33]" aria-hidden="true" />
              </div>
              <div>
                <h1 className="wiki-title text-xl font-bold text-[#202122]">
                  حساب غير مخوّل للإدارة
                </h1>
                <p className="text-xs text-[#54595d]">
                  تم تسجيل الدخول بـ:{' '}
                  <span dir="ltr" className="font-mono-tabular font-semibold text-[#202122]">
                    {firebaseUser.email}
                  </span>
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-[#54595d]">
              هذا الحساب لا يمتلك صلاحية الوصول إلى لوحة التحكم الإدارية في ويكي فيلي. يمكنك التبديل إلى حساب المشرف المعتمد أو العودة لتصفح الموسوعة والمساهمة فيها.
            </p>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full py-2.5 px-4 bg-[#3366cc] hover:bg-[#2a4b8d] text-white text-xs font-bold rounded flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>تسجيل الخروج والتبديل بحساب آخر</span>
              </button>
              <button
                type="button"
                onClick={navigateExitAdmin}
                className="w-full py-2 px-4 bg-white hover:bg-[#f8f9fa] text-[#202122] border border-[#a2a9b1] text-xs font-semibold rounded flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                <span>العودة إلى الموسوعة</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        {adminInspectingArticle && currentArticle ? (
          <div className="min-h-screen flex flex-col bg-white text-[#202122]">
            <header className="sticky top-0 z-40 bg-[#f8f9fa] border-b border-[#a2a9b1] px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-xs">
                <ShieldCheck className="w-4 h-4 text-[#14866d]" />
                <span className="font-bold text-[#202122]">
                  معاينة وتحكم الصفحة من وضع الإدارة ({activeMemberName})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isDarkMode}
                  onClick={handleToggleDarkMode}
                  title={isDarkMode ? 'العودة للوضع النهاري' : 'تفعيل وضع القراءة الليلي'}
                  className="px-2.5 py-1.5 bg-white hover:bg-[#eaf3ff] text-[#202122] border border-[#a2a9b1] text-xs font-semibold rounded inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {isDarkMode ? (
                    <Sun className="w-3.5 h-3.5 text-[#ac6600]" aria-hidden="true" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-[#3366cc]" aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline">
                    {isDarkMode ? 'وضع نهاري' : 'وضع ليلي'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdminInspectingArticle(false)}
                  className="px-3 py-1.5 bg-[#3366cc] hover:bg-[#2a4b8d] text-white text-xs font-bold rounded inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>العودة إلى لوحة الإدارة /admin</span>
                </button>
              </div>
            </header>
            <main className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-6">
              {renderNotice()}
              <ArticleView
                key={`admin-${currentArticle.id}-${currentArticle.updatedAt}-${currentArticle.imageUrl ?? ''}`}
                article={currentArticle}
                pendingForArticle={pendingForCurrentArticle}
                members={members}
                activeMemberName={activeMemberName}
                activeTab={articleTab}
                isAdminSession={true}
                showPageControlTab={true}
                isSignedIn={Boolean(firebaseUser?.emailVerified)}
                userDisplayName={firebaseUser?.displayName || firebaseUser?.email}
                onSignIn={handleSignInWithGoogle}
                settings={settings}
                canDeleteArticle={articles.length > 1}
                existingTitles={existingTitles}
                onWikiLinkClick={(title) => handleWikiLinkClick(title, true)}
                resolveWikiLinkHref={resolveWikiLinkHref}
                onNavigateHome={navigateExitAdmin}
                onTabChange={setArticleTab}
                onSelectPortal={handleSelectPortal}
                onSelectCategory={handleSelectGlobalCategory}
                onSelectSubcategory={handleSelectGlobalSubcategory}
                onSubmitEditProposal={handleSubmitEditProposal}
                onApproveRevision={handleApproveRevision}
                onRejectRevision={handleRejectRevision}
                onAddTalkMessage={handleAddTalkMessage}
                onUpdatePageControls={handleUpdatePageControls}
                onQuickToggleTag={handleQuickToggleArticleTag}
                onDeleteArticle={handleDeleteArticle}
              />
            </main>
          </div>
        ) : (
          <div>
            {notice && (
              <div className="fixed bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-md z-50">
                {renderNotice()}
              </div>
            )}
            <DashboardView
              articles={articles}
              articleMetrics={mergedArticleMetrics}
              pendingRevisions={pendingRevisions}
              reviewLog={reviewLog}
              members={members}
              activeMemberName={activeMemberName}
              adminEmail={firebaseUser.email}
              onSignOut={handleSignOut}
              settings={settings}
              onExitAdmin={navigateExitAdmin}
              onChangeActiveMember={handleChangeActiveMember}
              onAddMember={handleAddMember}
              onToggleMemberStatus={handleToggleMemberStatus}
              onRemoveMember={handleRemoveMember}
              onOpenArticle={(id) => handleOpenArticle(id, 'read', true)}
              onOpenPageControl={(id) => handleOpenArticle(id, 'control', true)}
              onToggleArticleStub={handleToggleArticleStub}
              onOpenNewArticle={() => setIsNewModalOpen(true)}
              onApproveRevision={handleApproveRevision}
              onRejectRevision={handleRejectRevision}
              onUpdateSettings={handleUpdateSettings}
              onExportJson={handleExportJson}
              onImportJson={handleImportJson}
              onResetDefaults={handleResetDefaults}
            />
          </div>
        )}

        <NewArticleModal
          isOpen={isNewModalOpen}
          isAdminSession={true}
          isSignedIn={Boolean(firebaseUser?.emailVerified)}
          userDisplayName={firebaseUser?.displayName || firebaseUser?.email}
          onSignIn={handleSignInWithGoogle}
          existingArticles={articles}
          members={members}
          activeMemberName={activeMemberName}
          settings={settings}
          onClose={() => setIsNewModalOpen(false)}
          onSubmitNewArticle={handleSubmitNewArticle}
        />
      </>
    );
  }

  // ---------------- الواجهة العامة للموسوعة (ويكي فيلي) ----------------
  return (
    <div className="min-h-screen flex flex-col bg-white text-[#202122]">
      <Header
        articles={articles}
        settings={settings}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onNavigateHome={handleNavigateHome}
        onSelectArticle={(id) => handleOpenArticle(id, 'read')}
        onOpenNewArticle={() => setIsNewModalOpen(true)}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen((v) => !v)}
      />

      <div className="max-w-[1440px] w-full mx-auto flex-1 flex relative">
        <WikiSidebar
          activePage={publicPage}
          articles={articles}
          currentArticle={currentArticle}
          selectedPortal={selectedPortal}
          selectedCategory={selectedCategory}
          selectedSubcategory={selectedSubcategory}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          onNavigate={(page) => {
            if (page === 'home') {
              handleNavigateHome();
            } else if (page === 'directory') {
              handleOpenDirectory();
            } else {
              setPublicPage(page);
            }
          }}
          onSelectPortal={(portal) => handleSelectPortal(portal)}
          onSelectCategory={(cat) => handleSelectGlobalCategory(cat)}
          onSelectSubcategory={(sub) =>
            selectedCategory !== 'الكل'
              ? handleSelectDirectorySubcategory(sub)
              : handleSelectGlobalSubcategory(sub)
          }
          onSelectArticle={(id) => handleOpenArticle(id, 'read')}
        />

        <main className="flex-1 min-w-0 px-4 sm:px-8 py-6 bg-white">
          {renderNotice()}

          {publicPage === 'home' && (
            <HomePageView
              articles={articles}
              settings={settings}
              onOpenArticle={(id) => handleOpenArticle(id, 'read')}
              onSelectPortal={(portal) => handleSelectPortal(portal)}
              onSelectCategory={(cat) => handleSelectGlobalCategory(cat)}
              onSelectSubcategory={(sub) => handleSelectGlobalSubcategory(sub)}
              onOpenDirectory={handleOpenDirectory}
              onOpenNewArticle={() => setIsNewModalOpen(true)}
            />
          )}

          {publicPage === 'directory' && (
            <DirectoryView
              articles={articles}
              pendingRevisions={pendingRevisions}
              selectedPortal={selectedPortal}
              onSelectPortal={handleSelectPortal}
              selectedCategory={selectedCategory}
              onSelectCategory={handleSelectDirectoryCategory}
              selectedSubcategory={selectedSubcategory}
              onSelectSubcategory={handleSelectDirectorySubcategory}
              isAdminSession={isAdmin}
              onNavigateHome={handleNavigateHome}
              onOpenArticle={(id) => handleOpenArticle(id, 'read')}
              onOpenPageControl={(id) => handleOpenArticle(id, 'control')}
              onOpenNewArticle={() => setIsNewModalOpen(true)}
            />
          )}

          {publicPage === 'article' && currentArticle && (
            <ArticleView
              key={`${currentArticle.id}-${currentArticle.updatedAt}-${currentArticle.imageUrl ?? ''}`}
              article={currentArticle}
              pendingForArticle={pendingForCurrentArticle}
              members={members}
              activeMemberName={activeMemberName}
              activeTab={articleTab}
              isAdminSession={isAdmin}
              showPageControlTab={false}
              isSignedIn={Boolean(firebaseUser?.emailVerified)}
              userDisplayName={firebaseUser?.displayName || firebaseUser?.email}
              onSignIn={handleSignInWithGoogle}
              settings={settings}
              canDeleteArticle={isAdmin && articles.length > 1}
              existingTitles={existingTitles}
              onWikiLinkClick={(title) => handleWikiLinkClick(title, false)}
              resolveWikiLinkHref={resolveWikiLinkHref}
              onNavigateHome={handleNavigateHome}
              onTabChange={handleArticleTabChange}
              onSelectPortal={(portal) => handleSelectPortal(portal)}
              onSelectCategory={handleSelectGlobalCategory}
              onSelectSubcategory={handleSelectGlobalSubcategory}
              onSubmitEditProposal={handleSubmitEditProposal}
              onApproveRevision={handleApproveRevision}
              onRejectRevision={handleRejectRevision}
              onAddTalkMessage={handleAddTalkMessage}
              onUpdatePageControls={handleUpdatePageControls}
              onQuickToggleTag={isAdmin ? handleQuickToggleArticleTag : undefined}
              onDeleteArticle={handleDeleteArticle}
            />
          )}
        </main>
      </div>

      <footer className="bg-[#f8f9fa] border-t border-[#eaecf0] mt-12 py-6 px-4 text-xs text-[#54595d]">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-[#202122]">
              {settings.siteName} — {settings.siteSubtitle}
            </p>
            <p className="mt-1">
              موسوعة مجانية شاملة لتوثيق تاريخ وثقافة وأعلام وعشائر ومدن الأكراد الفيليين تحت إشراف الأعضاء المعتمدين.
            </p>
          </div>
          <div className="flex items-center gap-4 text-[#3366cc]">
            <a
              href={getHomePath()}
              onClick={(e) => {
                if (shouldHandleClientNavigation(e)) {
                  e.preventDefault();
                  handleNavigateHome();
                }
              }}
              className="hover:underline"
            >
              الرئيسية
            </a>
            <span>•</span>
            <a
              href={getDirectoryPath()}
              onClick={(e) => {
                if (shouldHandleClientNavigation(e)) {
                  e.preventDefault();
                  handleOpenDirectory();
                }
              }}
              className="hover:underline"
            >
              البوابات والفهرس
            </a>
            <span>•</span>
            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="hover:underline cursor-pointer"
            >
              أضف مقالة جديدة
            </button>
          </div>
        </div>
      </footer>

      <NewArticleModal
        isOpen={isNewModalOpen}
        isAdminSession={isAdmin}
        isSignedIn={Boolean(firebaseUser?.emailVerified)}
        userDisplayName={firebaseUser?.displayName || firebaseUser?.email}
        onSignIn={handleSignInWithGoogle}
        existingArticles={articles}
        members={members}
        activeMemberName={activeMemberName}
        settings={settings}
        onClose={() => setIsNewModalOpen(false)}
        onSubmitNewArticle={handleSubmitNewArticle}
      />
    </div>
  );
}
