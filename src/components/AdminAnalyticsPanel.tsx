import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  BarChart3,
  Calendar,
  ExternalLink,
  Eye,
  MessageSquare,
  TrendingUp
} from 'lucide-react';
import {
  Article,
  ArticleMetricRecord,
  PendingRevision
} from '../types/encyclopedia';
import {
  AnalyticsWindowDays,
  RankedArticleMetric,
  buildMonthlyArticleAnalytics
} from '../utils/analytics';

interface AdminAnalyticsPanelProps {
  articles: Article[];
  articleMetrics: Record<string, ArticleMetricRecord>;
  pendingRevisions: PendingRevision[];
  reviewLog: PendingRevision[];
  onOpenArticle: (articleId: string) => void;
}

type MetricFocus = 'both' | 'views' | 'engagement';

interface CustomTooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  payload?: RankedArticleMetric & { label?: string; date?: string };
}

function ArticleBarTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div
      dir="rtl"
      className="bg-white border border-[#a2a9b1] rounded shadow-md p-3 text-xs text-right max-w-xs space-y-1.5"
    >
      <div className="font-editorial font-bold text-sm text-[#202122] leading-snug">
        {row.name}
      </div>
      <div className="text-[11px] text-[#54595d]">بوابة {row.portal}</div>
      <div className="border-t border-[#eaecf0] pt-1.5 space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#3366cc] font-semibold">الزيارات المسجّلة:</span>
          <span className="font-mono-tabular font-bold text-[#202122]">{row.views}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#14866d] font-semibold">إجمالي التفاعل:</span>
          <span className="font-mono-tabular font-bold text-[#202122]">{row.engagement}</span>
        </div>
        <div className="text-[10px] text-[#54595d] flex items-center justify-between gap-3 pt-0.5">
          <span>تعديلات ومراجعات: {row.revisionsAndReviews}</span>
          <span>نقاشات وتفاعل: {row.discussionsAndActions}</span>
        </div>
      </div>
    </div>
  );
}

function DailyTrendTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div
      dir="rtl"
      className="bg-white border border-[#a2a9b1] rounded shadow-md p-2.5 text-xs text-right space-y-1"
    >
      <div className="font-bold text-[#202122]">{point.label}</div>
      <div className="text-[10px] font-mono-tabular text-[#54595d]">{point.date}</div>
      <div className="border-t border-[#eaecf0] pt-1 space-y-0.5">
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4">
            <span className="font-semibold" style={{ color: entry.color }}>
              {entry.name}:
            </span>
            <span className="font-mono-tabular font-bold text-[#202122]">
              {entry.value ?? 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminAnalyticsPanel({
  articles,
  articleMetrics,
  pendingRevisions,
  reviewLog,
  onOpenArticle
}: AdminAnalyticsPanelProps) {
  const [windowDays, setWindowDays] = useState<AnalyticsWindowDays>(30);
  const [metricFocus, setMetricFocus] = useState<MetricFocus>('both');

  const analytics = useMemo(
    () =>
      buildMonthlyArticleAnalytics({
        articles,
        metricsMap: articleMetrics,
        pendingRevisions,
        reviewLog,
        windowDays
      }),
    [articles, articleMetrics, pendingRevisions, reviewLog, windowDays]
  );

  const chartArticles = useMemo(() => {
    const base = [...analytics.allRanked];
    if (metricFocus === 'views') {
      base.sort((a, b) => b.views - a.views || b.engagement - a.engagement);
    } else if (metricFocus === 'engagement') {
      base.sort((a, b) => b.engagement - a.engagement || b.views - a.views);
    }
    return base.slice(0, 8);
  }, [analytics.allRanked, metricFocus]);

  const barChartHeight = Math.max(260, chartArticles.length * 40 + 44);

  const windowLabel =
    windowDays === 30
      ? 'خلال الشهر الماضي (30 يوماً)'
      : windowDays === 14
        ? 'خلال آخر 14 يوماً'
        : 'خلال آخر 7 أيام';

  return (
    <section
      aria-label="لوحة الإحصائيات البصرية للزيارات والتفاعل"
      className="bg-white border border-[#a2a9b1] rounded overflow-hidden"
    >
      {/* الترويسة وأدوات التحكم الزمنية */}
      <div className="bg-[#f8f9fa] px-4 py-3.5 border-b border-[#eaecf0] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-sm sm:text-base text-[#202122] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#3366cc]" aria-hidden="true" />
            <span>لوحة الإحصائيات البصرية — أكثر المقالات زيارةً وتفاعلاً</span>
          </h2>
          <p className="text-[11px] text-[#54595d] mt-0.5 flex flex-wrap items-center gap-1.5">
            <Calendar className="w-3 h-3" aria-hidden="true" />
            <span>
              الفترة: {windowLabel} (
              <span className="font-mono-tabular" dir="ltr">
                {analytics.startDate} → {analytics.endDate}
              </span>
              )
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* اختيار الفترة الزمنية */}
          <div
            role="group"
            aria-label="الفترة الزمنية للإحصائيات"
            className="inline-flex items-center bg-white border border-[#a2a9b1] rounded overflow-hidden"
          >
            {([30, 14, 7] as AnalyticsWindowDays[]).map((days, idx) => (
              <button
                key={days}
                type="button"
                onClick={() => setWindowDays(days)}
                className={`px-2.5 py-1.5 font-medium transition cursor-pointer ${
                  idx > 0 ? 'border-r border-[#eaecf0]' : ''
                } ${
                  windowDays === days
                    ? 'bg-[#3366cc] text-white font-bold'
                    : 'text-[#202122] hover:bg-[#f8f9fa]'
                }`}
              >
                {days === 30 ? 'الشهر الماضي' : `${days} يوماً`}
              </button>
            ))}
          </div>

          {/* اختيار مقياس العرض */}
          <div
            role="group"
            aria-label="مقياس الترتيب"
            className="inline-flex items-center bg-white border border-[#a2a9b1] rounded overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setMetricFocus('both')}
              className={`px-2.5 py-1.5 font-medium transition cursor-pointer ${
                metricFocus === 'both'
                  ? 'bg-[#202122] text-white font-bold'
                  : 'text-[#202122] hover:bg-[#f8f9fa]'
              }`}
            >
              الكل
            </button>
            <button
              type="button"
              onClick={() => setMetricFocus('views')}
              className={`px-2.5 py-1.5 font-medium border-r border-[#eaecf0] transition cursor-pointer ${
                metricFocus === 'views'
                  ? 'bg-[#3366cc] text-white font-bold'
                  : 'text-[#3366cc] hover:bg-[#eaf3ff]'
              }`}
            >
              الزيارات
            </button>
            <button
              type="button"
              onClick={() => setMetricFocus('engagement')}
              className={`px-2.5 py-1.5 font-medium border-r border-[#eaecf0] transition cursor-pointer ${
                metricFocus === 'engagement'
                  ? 'bg-[#14866d] text-white font-bold'
                  : 'text-[#14866d] hover:bg-emerald-50'
              }`}
            >
              التفاعل
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-6">
        {/* شريط المؤشرات السريعة للفترة المختارة */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-[#f8f9fa] border border-[#eaecf0] rounded p-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-[#54595d] flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-[#3366cc]" aria-hidden="true" />
                <span>إجمالي الزيارات ({windowDays} يوماً)</span>
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-[#202122] mt-1">
                {analytics.totalViews}
              </div>
            </div>
            <div className="text-left text-[11px] text-[#54595d]">
              {analytics.activeArticlesCount} مقالة نشطة
            </div>
          </div>

          <div className="bg-[#f8f9fa] border border-[#eaecf0] rounded p-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-[#54595d] flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-[#14866d]" aria-hidden="true" />
                <span>إجمالي التفاعل والمساهمات</span>
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-[#14866d] mt-1">
                {analytics.totalEngagement}
              </div>
            </div>
            <div className="text-left text-[11px] text-[#54595d]">
              تعديلات · نقاشات · مراجعات
            </div>
          </div>

          <div className="bg-[#f8f9fa] border border-[#eaecf0] rounded p-3 flex flex-col justify-between">
            <div className="text-[#54595d] flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5 text-[#ac6600]" aria-hidden="true" />
              <span>
                {metricFocus === 'engagement' ? 'المقالة الأكثر تفاعلاً' : 'المقالة المتصدّرة'}
              </span>
            </div>
            {(metricFocus === 'engagement' ? analytics.mostEngaged : analytics.mostVisited) ? (
              <div className="mt-1 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onOpenArticle(
                      (metricFocus === 'engagement'
                        ? analytics.mostEngaged
                        : analytics.mostVisited)!.articleId
                    )
                  }
                  className="font-editorial font-bold text-sm text-[#3366cc] hover:underline truncate text-right cursor-pointer"
                >
                  {
                    (metricFocus === 'engagement'
                      ? analytics.mostEngaged
                      : analytics.mostVisited)!.name
                  }
                </button>
                <span className="font-mono-tabular text-[11px] text-[#54595d] shrink-0">
                  {(metricFocus === 'engagement'
                    ? analytics.mostEngaged
                    : analytics.mostVisited)!.views}{' '}
                  زيارة ·{' '}
                  {(metricFocus === 'engagement'
                    ? analytics.mostEngaged
                    : analytics.mostVisited)!.engagement}{' '}
                  تفاعل
                </span>
              </div>
            ) : (
              <div className="text-[#54595d] mt-1">لا توجد بيانات بعد</div>
            )}
          </div>
        </div>

        {/* الرسوم البيانية التفاعلية عبر Recharts */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* الرسم 1: أكثر المقالات زيارةً وتفاعلاً (مخطط أعمدة أفقي) */}
          <div className="xl:col-span-7 border border-[#eaecf0] rounded p-3.5 bg-white">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-[#202122]">
                  أكثر {chartArticles.length} مقالات زيارةً وتفاعلاً
                </h3>
                <p className="text-[11px] text-[#54595d]">
                  مقارنة مباشرة بين عدد الزيارات المسجّلة ومعدل التفاعل (التعديلات والمراجعات والنقاشات)
                </p>
              </div>
            </div>

            <div dir="ltr" style={{ width: '100%', height: barChartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartArticles}
                  layout="vertical"
                  margin={{ top: 6, right: 18, left: 10, bottom: 6 }}
                  barGap={4}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#eaecf0" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#54595d' }}
                    axisLine={{ stroke: '#c8ccd1' }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="shortName"
                    width={132}
                    tick={{ fontSize: 11, fill: '#202122' }}
                    axisLine={{ stroke: '#c8ccd1' }}
                    tickLine={false}
                  />
                  <Tooltip content={<ArticleBarTooltip />} cursor={{ fill: '#f8f9fa' }} />
                  <Legend
                    wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                    formatter={(value) => (
                      <span className="text-[#202122] font-medium mx-1">{value}</span>
                    )}
                  />
                  {(metricFocus === 'both' || metricFocus === 'views') && (
                    <Bar
                      dataKey="views"
                      name="الزيارات"
                      fill="#3366cc"
                      radius={[0, 3, 3, 0]}
                      maxBarSize={16}
                    />
                  )}
                  {(metricFocus === 'both' || metricFocus === 'engagement') && (
                    <Bar
                      dataKey="engagement"
                      name="التفاعل والمساهمات"
                      fill="#14866d"
                      radius={[0, 3, 3, 0]}
                      maxBarSize={16}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* الرسم 2: منحنى النشاط اليومي خلال الشهر الماضي (AreaChart) */}
          <div className="xl:col-span-5 border border-[#eaecf0] rounded p-3.5 bg-white flex flex-col">
            <div className="mb-3">
              <h3 className="font-bold text-xs sm:text-sm text-[#202122]">
                المنحنى اليومي للزيارات والتفاعل
              </h3>
              <p className="text-[11px] text-[#54595d]">
                تطور حركة القراءة والتعديلات والنقاشات يوماً بيوم {windowLabel}
              </p>
            </div>

            <div dir="ltr" className="flex-1 min-h-[260px]" style={{ width: '100%' }}>
              <ResponsiveContainer width="100%" height={Math.max(260, barChartHeight - 10)}>
                <AreaChart
                  data={analytics.dailyTrend}
                  margin={{ top: 8, right: 12, left: -12, bottom: 6 }}
                >
                  <defs>
                    <linearGradient id="wikiViewsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3366cc" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#3366cc" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="wikiEngageFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14866d" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="#14866d" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eaecf0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#54595d' }}
                    interval={windowDays === 30 ? 4 : windowDays === 14 ? 2 : 0}
                    axisLine={{ stroke: '#c8ccd1' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#54595d' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<DailyTrendTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                    formatter={(value) => (
                      <span className="text-[#202122] font-medium mx-1">{value}</span>
                    )}
                  />
                  {(metricFocus === 'both' || metricFocus === 'views') && (
                    <Area
                      type="monotone"
                      dataKey="views"
                      name="الزيارات اليومية"
                      stroke="#3366cc"
                      strokeWidth={2}
                      fill="url(#wikiViewsFill)"
                      activeDot={{ r: 4 }}
                    />
                  )}
                  {(metricFocus === 'both' || metricFocus === 'engagement') && (
                    <Area
                      type="monotone"
                      dataKey="engagement"
                      name="التفاعل اليومي"
                      stroke="#14866d"
                      strokeWidth={2}
                      fill="url(#wikiEngageFill)"
                      activeDot={{ r: 4 }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* جدول مختصر لأكثر المقالات تفاعلاً وزيارةً مع فتح سريع */}
        <div className="border border-[#eaecf0] rounded overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8f9fa] border-b border-[#eaecf0] text-[#54595d]">
                <th className="py-2 px-3 font-semibold w-10">#</th>
                <th className="py-2 px-3 font-semibold">المقالة</th>
                <th className="py-2 px-3 font-semibold">البوابة</th>
                <th className="py-2 px-3 font-semibold">الزيارات</th>
                <th className="py-2 px-3 font-semibold">تعديلات ومراجعات</th>
                <th className="py-2 px-3 font-semibold">نقاشات وتفاعل</th>
                <th className="py-2 px-3 font-semibold text-left">فتح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaecf0]">
              {chartArticles.slice(0, 6).map((item, idx) => (
                <tr key={item.articleId} className="hover:bg-[#f8f9fa]">
                  <td className="py-2.5 px-3 font-mono-tabular font-bold text-[#54595d]">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => onOpenArticle(item.articleId)}
                      className="font-editorial text-sm font-bold text-[#3366cc] hover:underline text-right cursor-pointer"
                    >
                      {item.name}
                    </button>
                  </td>
                  <td className="py-2.5 px-3 text-[#54595d] whitespace-nowrap">
                    {item.portal}
                  </td>
                  <td className="py-2.5 px-3 font-mono-tabular font-bold text-[#3366cc]">
                    {item.views}
                  </td>
                  <td className="py-2.5 px-3 font-mono-tabular text-[#14866d] font-semibold">
                    {item.revisionsAndReviews}
                  </td>
                  <td className="py-2.5 px-3 font-mono-tabular text-[#54595d]">
                    {item.discussionsAndActions}
                  </td>
                  <td className="py-2.5 px-3 text-left">
                    <button
                      type="button"
                      onClick={() => onOpenArticle(item.articleId)}
                      className="inline-flex items-center gap-1 text-[#3366cc] hover:underline font-medium cursor-pointer"
                    >
                      <span>عرض</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
