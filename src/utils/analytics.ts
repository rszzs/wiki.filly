import {
  Article,
  ArticleDailyBucket,
  ArticleMetricRecord,
  PendingRevision,
  WIKI_PORTALS,
  WikiPortal
} from '../types/encyclopedia';

const LOCAL_METRICS_STORAGE_KEY = 'wiki_feyli_article_metrics_v1';

export type AnalyticsWindowDays = 7 | 14 | 30;

export interface RankedArticleMetric {
  articleId: string;
  name: string;
  shortName: string;
  portal: WikiPortal;
  views: number;
  revisionsAndReviews: number;
  discussionsAndActions: number;
  engagement: number;
  combinedScore: number;
  lastActivity: string;
}

export interface DailyAnalyticsPoint {
  date: string;
  label: string;
  views: number;
  engagement: number;
  total: number;
}

export interface PortalAnalyticsPoint {
  portal: WikiPortal;
  shortLabel: string;
  views: number;
  engagement: number;
  articleCount: number;
}

export interface MonthlyAnalyticsSummary {
  windowDays: AnalyticsWindowDays;
  startDate: string;
  endDate: string;
  totalViews: number;
  totalEngagement: number;
  activeArticlesCount: number;
  mostVisited: RankedArticleMetric | null;
  mostEngaged: RankedArticleMetric | null;
  topArticles: RankedArticleMetric[];
  allRanked: RankedArticleMetric[];
  dailyTrend: DailyAnalyticsPoint[];
  portalBreakdown: PortalAnalyticsPoint[];
}

export function getTodayDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

const ARABIC_SHORT_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر'
];

export function formatArabicShortDate(dateKey: string): string {
  const parts = dateKey.split('-');
  if (parts.length !== 3) return dateKey;
  const monthIdx = Math.max(0, Math.min(11, Number(parts[1]) - 1));
  const day = Number(parts[2]);
  return `${day} ${ARABIC_SHORT_MONTHS[monthIdx]}`;
}

function extractDateKey(timestamp?: string): string | null {
  if (!timestamp) return null;
  const m = timestamp.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function truncateLabel(text: string, maxLen = 18): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

export function loadLocalArticleMetrics(): Record<string, ArticleMetricRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_METRICS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ArticleMetricRecord>;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

export function recordLocalArticleEvent(
  articleId: string,
  kind: 'view' | 'interaction',
  dateKey: string,
  timestamp: string
): Record<string, ArticleMetricRecord> {
  const current = loadLocalArticleMetrics();
  const prev = current[articleId] ?? {
    articleId,
    totalViews: 0,
    totalInteractions: 0,
    dailyBuckets: [],
    lastVisitedAt: timestamp
  };

  const buckets: ArticleDailyBucket[] = prev.dailyBuckets.map((b) => ({ ...b }));
  const target = buckets.find((b) => b.date === dateKey);
  if (target) {
    if (kind === 'view') target.views += 1;
    else target.interactions += 1;
  } else {
    buckets.push({
      date: dateKey,
      views: kind === 'view' ? 1 : 0,
      interactions: kind === 'interaction' ? 1 : 0
    });
  }

  const nextRecord: ArticleMetricRecord = {
    articleId,
    totalViews: prev.totalViews + (kind === 'view' ? 1 : 0),
    totalInteractions: prev.totalInteractions + (kind === 'interaction' ? 1 : 0),
    dailyBuckets: buckets.sort((a, b) => a.date.localeCompare(b.date)).slice(-35),
    lastVisitedAt: timestamp
  };

  const nextMap = { ...current, [articleId]: nextRecord };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LOCAL_METRICS_STORAGE_KEY, JSON.stringify(nextMap));
    } catch {
      // ignore storage quota errors
    }
  }
  return nextMap;
}

export function mergeArticleMetrics(
  firestoreMetrics: Record<string, ArticleMetricRecord>,
  localMetrics: Record<string, ArticleMetricRecord>
): Record<string, ArticleMetricRecord> {
  const allIds = new Set([
    ...Object.keys(firestoreMetrics),
    ...Object.keys(localMetrics)
  ]);
  const merged: Record<string, ArticleMetricRecord> = {};

  allIds.forEach((articleId) => {
    const fsRec = firestoreMetrics[articleId];
    const locRec = localMetrics[articleId];
    if (fsRec && !locRec) {
      merged[articleId] = fsRec;
      return;
    }
    if (!fsRec && locRec) {
      merged[articleId] = locRec;
      return;
    }
    if (!fsRec || !locRec) return;

    const bucketMap = new Map<string, ArticleDailyBucket>();
    for (const b of fsRec.dailyBuckets) {
      bucketMap.set(b.date, { ...b });
    }
    for (const b of locRec.dailyBuckets) {
      const existing = bucketMap.get(b.date);
      if (existing) {
        existing.views = Math.max(existing.views, b.views);
        existing.interactions = Math.max(existing.interactions, b.interactions);
      } else {
        bucketMap.set(b.date, { ...b });
      }
    }

    const dailyBuckets = Array.from(bucketMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-35);

    merged[articleId] = {
      articleId,
      totalViews: Math.max(fsRec.totalViews, locRec.totalViews),
      totalInteractions: Math.max(fsRec.totalInteractions, locRec.totalInteractions),
      dailyBuckets,
      lastVisitedAt:
        fsRec.lastVisitedAt >= locRec.lastVisitedAt
          ? fsRec.lastVisitedAt
          : locRec.lastVisitedAt
    };
  });

  return merged;
}

export function buildMonthlyArticleAnalytics(params: {
  articles: Article[];
  metricsMap: Record<string, ArticleMetricRecord>;
  pendingRevisions: PendingRevision[];
  reviewLog: PendingRevision[];
  windowDays: AnalyticsWindowDays;
  referenceDateKey?: string;
}): MonthlyAnalyticsSummary {
  const {
    articles,
    metricsMap,
    pendingRevisions,
    reviewLog,
    windowDays,
    referenceDateKey
  } = params;

  const endDate = referenceDateKey ?? getTodayDateKey();
  const startDate = addDays(endDate, -(windowDays - 1));

  // بناء الخريطة اليومية لجميع أيام النافذة الزمنية
  const dailyMap = new Map<string, { views: number; engagement: number }>();
  for (let i = 0; i < windowDays; i += 1) {
    const dayKey = addDays(startDate, i);
    dailyMap.set(dayKey, { views: 0, engagement: 0 });
  }

  const inWindow = (dateKey: string | null): dateKey is string =>
    Boolean(dateKey && dateKey >= startDate && dateKey <= endDate);

  const pendingByArticle = new Map<string, PendingRevision[]>();
  [...pendingRevisions, ...reviewLog].forEach((rev) => {
    const list = pendingByArticle.get(rev.articleId) ?? [];
    list.push(rev);
    pendingByArticle.set(rev.articleId, list);
  });

  const allRanked: RankedArticleMetric[] = articles.map((art) => {
    const metric = metricsMap[art.id];
    let views = 0;
    let trackedInteractions = 0;
    let lastActivity = art.updatedAt || '';

    if (metric) {
      if (metric.lastVisitedAt && metric.lastVisitedAt > lastActivity) {
        lastActivity = metric.lastVisitedAt;
      }
      for (const b of metric.dailyBuckets) {
        if (inWindow(b.date)) {
          views += b.views;
          trackedInteractions += b.interactions;
          const daySlot = dailyMap.get(b.date);
          if (daySlot) {
            daySlot.views += b.views;
            daySlot.engagement += b.interactions;
          }
        }
      }
    }

    // التعديلات والمراجعات الفعلية ضمن النافذة الزمنية
    let revisionsAndReviews = 0;
    for (const rev of art.history) {
      const dk = extractDateKey(rev.timestamp);
      if (inWindow(dk)) {
        revisionsAndReviews += 1;
        if (rev.timestamp > lastActivity) lastActivity = rev.timestamp;
        const daySlot = dailyMap.get(dk);
        if (daySlot) daySlot.engagement += 1;
      }
    }

    const revSubmissions = pendingByArticle.get(art.id) ?? [];
    for (const sub of revSubmissions) {
      const dk = extractDateKey(sub.submittedAt) ?? extractDateKey(sub.reviewedAt);
      if (inWindow(dk)) {
        revisionsAndReviews += 1;
        const ts = sub.reviewedAt || sub.submittedAt;
        if (ts > lastActivity) lastActivity = ts;
        const daySlot = dailyMap.get(dk);
        if (daySlot) daySlot.engagement += 1;
      }
    }

    // نقاشات المقالة المسجّلة ضمن النافذة الزمنية
    let talkCount = 0;
    for (const msg of art.talkMessages) {
      const dk = extractDateKey(msg.createdAt);
      if (inWindow(dk)) {
        talkCount += 1;
        if (msg.createdAt > lastActivity) lastActivity = msg.createdAt;
        const daySlot = dailyMap.get(dk);
        if (daySlot) daySlot.engagement += 1;
      }
    }

    const discussionsAndActions = talkCount + trackedInteractions;
    const engagement = revisionsAndReviews + discussionsAndActions;
    const combinedScore = views + engagement * 2;

    return {
      articleId: art.id,
      name: art.name,
      shortName: truncateLabel(art.name, 20),
      portal: art.portal,
      views,
      revisionsAndReviews,
      discussionsAndActions,
      engagement,
      combinedScore,
      lastActivity
    };
  });

  const sortedCombined = [...allRanked].sort(
    (a, b) =>
      b.combinedScore - a.combinedScore ||
      b.views - a.views ||
      b.engagement - a.engagement ||
      a.name.localeCompare(b.name, 'ar')
  );

  const sortedByViews = [...allRanked].sort(
    (a, b) => b.views - a.views || b.engagement - a.engagement
  );
  const sortedByEngagement = [...allRanked].sort(
    (a, b) => b.engagement - a.engagement || b.views - a.views
  );

  const totalViews = allRanked.reduce((sum, item) => sum + item.views, 0);
  const totalEngagement = allRanked.reduce((sum, item) => sum + item.engagement, 0);
  const activeArticlesCount = allRanked.filter(
    (item) => item.views > 0 || item.engagement > 0
  ).length;

  const dailyTrend: DailyAnalyticsPoint[] = Array.from(dailyMap.entries()).map(
    ([date, counts]) => ({
      date,
      label: formatArabicShortDate(date),
      views: counts.views,
      engagement: counts.engagement,
      total: counts.views + counts.engagement
    })
  );

  const portalBreakdown: PortalAnalyticsPoint[] = WIKI_PORTALS.map((portal) => {
    const items = allRanked.filter((a) => a.portal === portal.id);
    return {
      portal: portal.id,
      shortLabel: portal.shortLabel,
      views: items.reduce((s, x) => s + x.views, 0),
      engagement: items.reduce((s, x) => s + x.engagement, 0),
      articleCount: items.length
    };
  });

  return {
    windowDays,
    startDate,
    endDate,
    totalViews,
    totalEngagement,
    activeArticlesCount,
    mostVisited: sortedByViews[0] && sortedByViews[0].views > 0 ? sortedByViews[0] : sortedCombined[0] ?? null,
    mostEngaged: sortedByEngagement[0] && sortedByEngagement[0].engagement > 0 ? sortedByEngagement[0] : sortedCombined[0] ?? null,
    topArticles: sortedCombined.slice(0, 8),
    allRanked: sortedCombined,
    dailyTrend,
    portalBreakdown
  };
}
