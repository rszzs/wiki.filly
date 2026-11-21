import React, { useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FilePlus2,
  GitPullRequest,
  Lock,
  Plus,
  RotateCcw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sprout,
  Trash2,
  Upload,
  UserCheck,
  UserCog,
  Users,
  XCircle
} from 'lucide-react';
import {
  Article,
  ArticleMetricRecord,
  MemberAccount,
  PendingRevision,
  ProtectionLevel,
  SystemSettings,
  WIKI_PORTALS,
  evaluateArticleStubStatus
} from '../types/encyclopedia';
import { buildDiffComparison } from '../utils/diff';
import { sanitizeImageUrl } from '../utils/storage';
import { AdminAnalyticsPanel } from './AdminAnalyticsPanel';
import { PortraitMedallion, SmartExternalImage } from './PortraitMedallion';

type AdminSection =
  | 'overview'
  | 'contributions'
  | 'pages'
  | 'accounts'
  | 'settings';

interface DashboardViewProps {
  articles: Article[];
  articleMetrics: Record<string, ArticleMetricRecord>;
  pendingRevisions: PendingRevision[];
  reviewLog: PendingRevision[];
  members: MemberAccount[];
  activeMemberName: string;
  adminEmail?: string | null;
  onSignOut?: () => void;
  settings: SystemSettings;
  onExitAdmin: () => void;
  onChangeActiveMember: (name: string) => void;
  onAddMember: (payload: {
    name: string;
    roleTitle: string;
    specialty: string;
  }) => void;
  onToggleMemberStatus: (memberId: string) => void;
  onRemoveMember: (memberId: string) => void;
  onOpenArticle: (articleId: string) => void;
  onOpenPageControl: (articleId: string) => void;
  onToggleArticleStub: (articleId: string, nextIsStub: boolean) => void;
  onOpenNewArticle: () => void;
  onApproveRevision: (revisionId: string) => void;
  onRejectRevision: (revisionId: string, reason: string) => void;
  onUpdateSettings: (next: SystemSettings) => void;
  onExportJson: () => void;
  onImportJson: (rawText: string) => void;
  onResetDefaults: () => void;
}

const PROTECTION_LABELS: Record<ProtectionLevel, string> = {
  'semi-protected': 'محمية جزئياً',
  'strict-review': 'مراجعة مشددة',
  open: 'مفتوحة'
};

export function DashboardView({
  articles,
  articleMetrics,
  pendingRevisions,
  reviewLog,
  members,
  activeMemberName,
  adminEmail,
  onSignOut,
  settings,
  onExitAdmin,
  onChangeActiveMember,
  onAddMember,
  onToggleMemberStatus,
  onRemoveMember,
  onOpenArticle,
  onOpenPageControl,
  onToggleArticleStub,
  onOpenNewArticle,
  onApproveRevision,
  onRejectRevision,
  onUpdateSettings,
  onExportJson,
  onImportJson,
  onResetDefaults
}: DashboardViewProps) {
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(
    pendingRevisions[0]?.id ?? null
  );
  const [portalFilter, setPortalFilter] = useState<string>('الكل');
  const [stubFilter, setStubFilter] = useState<'all' | 'stub' | 'complete'>('all');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  // Account creation form
  const [newAccName, setNewAccName] = useState('');
  const [newAccRole, setNewAccRole] = useState('عضو مراجع');
  const [newAccSpecialty, setNewAccSpecialty] = useState('');

  // System settings form
  const [formSettings, setFormSettings] = useState<SystemSettings>(settings);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const figuresCount = useMemo(
    () => articles.filter((a) => a.portal === 'شخصيات وأعلام').length,
    [articles]
  );

  // Latest edits across all articles + reviewLog
  const latestEdits = useMemo(() => {
    const historyEvents = articles.flatMap((art) =>
      art.history.map((rev) => ({
        id: `${art.id}-${rev.id}`,
        articleId: art.id,
        articleName: art.name,
        portal: art.portal,
        author: rev.author,
        approver: rev.approver ?? 'هيئة التحرير',
        summary: rev.summary,
        timestamp: rev.timestamp,
        status: rev.status ?? 'approved'
      }))
    );
    return historyEvents
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 8);
  }, [articles]);

  const activeRevision = useMemo(() => {
    if (pendingRevisions.length === 0) return null;
    return (
      pendingRevisions.find((r) => r.id === selectedRevisionId) ?? pendingRevisions[0]
    );
  }, [pendingRevisions, selectedRevisionId]);

  const diffItems = useMemo(() => {
    if (!activeRevision) return [];
    return buildDiffComparison(
      activeRevision.originalData,
      activeRevision.proposedData
    ).filter((d) => d.hasChanges);
  }, [activeRevision]);

  const stubEvalMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof evaluateArticleStubStatus>>();
    articles.forEach((a) => map.set(a.id, evaluateArticleStubStatus(a)));
    return map;
  }, [articles]);

  const stubArticlesCount = useMemo(
    () => articles.filter((a) => stubEvalMap.get(a.id)?.isStub).length,
    [articles, stubEvalMap]
  );

  const completeArticlesCount = articles.length - stubArticlesCount;

  const filteredPages = useMemo(() => {
    return articles.filter((a) => {
      if (portalFilter !== 'الكل' && a.portal !== portalFilter) return false;
      const isStub = stubEvalMap.get(a.id)?.isStub ?? false;
      if (stubFilter === 'stub' && !isStub) return false;
      if (stubFilter === 'complete' && isStub) return false;
      return true;
    });
  }, [articles, portalFilter, stubFilter, stubEvalMap]);

  const handleConfirmReject = (revId: string) => {
    const trimmed = rejectionReason.trim();
    if (!trimmed) {
      setReasonError('يرجى كتابة سبب واضح للرفض.');
      return;
    }
    onRejectRevision(revId, trimmed);
    setRejectingId(null);
    setRejectionReason('');
    setReasonError('');
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;
    onAddMember({
      name: newAccName.trim(),
      roleTitle: newAccRole,
      specialty: newAccSpecialty.trim() || 'التوثيق العام'
    });
    setNewAccName('');
    setNewAccSpecialty('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImportJson(reader.result);
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const proposedImgUrl = activeRevision
    ? sanitizeImageUrl(activeRevision.proposedData.imageUrl)
    : '';

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fa] text-[#202122]">
      {/* الشريط العلوي الإداري الخاص برابط /admin */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#a2a9b1] px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#3366cc] text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="font-editorial text-xl font-bold text-[#202122] leading-tight">
              لوحة إدارة {settings.siteName}
            </div>
            <div className="text-[11px] text-[#54595d] font-mono-tabular">
              /admin · الإدارة المركزية وإشراف الأعضاء
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs bg-[#f8f9fa] border border-[#eaecf0] rounded px-2.5 py-1">
            <span className="text-[#54595d]">الحساب النشط:</span>
            <select
              value={activeMemberName}
              onChange={(e) => onChangeActiveMember(e.target.value)}
              aria-label="تبديل حساب المشرف النشط"
              className="bg-transparent font-bold text-[#202122] focus:outline-none"
            >
              {members
                .filter((m) => m.status === 'active')
                .map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
            </select>
          </div>

          {adminEmail && (
            <span className="hidden lg:inline text-[11px] font-mono-tabular text-[#54595d]" dir="ltr">
              {adminEmail}
            </span>
          )}

          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="px-3 py-1.5 bg-white hover:bg-red-50 text-[#d33] border border-[#a2a9b1] text-xs font-bold rounded cursor-pointer"
            >
              تسجيل الخروج
            </button>
          )}

          <button
            type="button"
            onClick={onExitAdmin}
            className="px-3.5 py-1.5 bg-white hover:bg-[#eaf3ff] text-[#3366cc] border border-[#a2a9b1] text-xs font-bold rounded inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            <span>العودة إلى الموسوعة</span>
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-[1440px] w-full mx-auto flex flex-col lg:flex-row">
        {/* الواجهة الجانبية للتنقل السريع (Admin Quick Navigation Sidebar) */}
        <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-l border-[#eaecf0] p-4 shrink-0 space-y-6">
          <nav aria-label="تنقل لوحة الإدارة" className="space-y-1 text-xs">
            <div className="text-[11px] font-bold text-[#54595d] px-2 pb-1.5 border-b border-[#eaecf0] mb-2">
              التنقل الإداري السريع
            </div>

            <button
              type="button"
              onClick={() => setActiveSection('overview')}
              className={`w-full text-right px-3 py-2.5 rounded flex items-center justify-between gap-2 transition cursor-pointer ${
                activeSection === 'overview'
                  ? 'bg-[#3366cc] text-white font-bold'
                  : 'text-[#202122] hover:bg-[#f8f9fa]'
              }`}
            >
              <span className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" aria-hidden="true" />
                <span>إحصائيات الموسوعة</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('contributions')}
              className={`w-full text-right px-3 py-2.5 rounded flex items-center justify-between gap-2 transition cursor-pointer ${
                activeSection === 'contributions'
                  ? 'bg-[#3366cc] text-white font-bold'
                  : 'text-[#202122] hover:bg-[#f8f9fa]'
              }`}
            >
              <span className="flex items-center gap-2">
                <GitPullRequest className="w-4 h-4" aria-hidden="true" />
                <span>مراجعة المساهمات</span>
              </span>
              {pendingRevisions.length > 0 && (
                <span
                  className={`font-mono-tabular px-1.5 py-0.5 rounded-full text-[11px] ${
                    activeSection === 'contributions'
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-100 text-amber-900 font-bold'
                  }`}
                >
                  {pendingRevisions.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveSection('pages');
              }}
              className={`w-full text-right px-3 py-2.5 rounded flex items-center justify-between gap-2 transition cursor-pointer ${
                activeSection === 'pages' && stubFilter !== 'stub'
                  ? 'bg-[#3366cc] text-white font-bold'
                  : 'text-[#202122] hover:bg-[#f8f9fa]'
              }`}
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
                <span>الصفحات والبوابات</span>
              </span>
              <span className="font-mono-tabular text-[11px] opacity-80">
                {articles.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStubFilter('stub');
                setPortalFilter('الكل');
                setActiveSection('pages');
              }}
              className={`w-full text-right px-3 py-2 rounded flex items-center justify-between gap-2 transition cursor-pointer ${
                activeSection === 'pages' && stubFilter === 'stub'
                  ? 'bg-[#ac6600] text-white font-bold'
                  : 'text-[#613900] bg-amber-50/70 hover:bg-amber-100/80 border border-amber-200/80'
              }`}
            >
              <span className="flex items-center gap-2">
                <Sprout className="w-4 h-4" aria-hidden="true" />
                <span>مقالات البذرة</span>
              </span>
              <span
                className={`font-mono-tabular px-1.5 py-0.5 rounded-full text-[11px] ${
                  activeSection === 'pages' && stubFilter === 'stub'
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-200/80 text-amber-950 font-bold'
                }`}
              >
                {stubArticlesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('accounts')}
              className={`w-full text-right px-3 py-2.5 rounded flex items-center justify-between gap-2 transition cursor-pointer ${
                activeSection === 'accounts'
                  ? 'bg-[#3366cc] text-white font-bold'
                  : 'text-[#202122] hover:bg-[#f8f9fa]'
              }`}
            >
              <span className="flex items-center gap-2">
                <UserCog className="w-4 h-4" aria-hidden="true" />
                <span>إدارة الحسابات</span>
              </span>
              <span className="font-mono-tabular text-[11px] opacity-80">
                {members.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFormSettings(settings);
                setActiveSection('settings');
              }}
              className={`w-full text-right px-3 py-2.5 rounded flex items-center justify-between gap-2 transition cursor-pointer ${
                activeSection === 'settings'
                  ? 'bg-[#3366cc] text-white font-bold'
                  : 'text-[#202122] hover:bg-[#f8f9fa]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Settings className="w-4 h-4" aria-hidden="true" />
                <span>إعدادات النظام العام</span>
              </span>
            </button>
          </nav>

          {/* اختصارات سريعة */}
          <div className="pt-4 border-t border-[#eaecf0] space-y-2 text-xs">
            <button
              type="button"
              onClick={onOpenNewArticle}
              className="w-full px-3 py-2 bg-[#14866d] hover:bg-emerald-800 text-white font-bold rounded flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4" aria-hidden="true" />
              <span>إنشاء صفحة جديدة</span>
            </button>
          </div>
        </aside>

        {/* منطقة العمل الإدارية الرئيسية */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6">
          {/* 1. نظرة عامة وإحصائيات الموسوعة */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div>
                <h1 className="wiki-title text-3xl font-bold text-[#202122]">
                  إحصائيات الموسوعة والنشاط العام
                </h1>
                <p className="text-xs text-[#54595d] mt-1">
                  ملخص فوري لعدد الأعلام والمقالات، المساهمات المعلقة تحت الإشراف، وآخر التعديلات المعتمدة.
                </p>
              </div>

              {/* بطاقات الإحصائيات */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <div className="bg-white border border-[#a2a9b1] rounded p-4">
                  <div className="text-xs text-[#54595d]">عدد الأعلام والمقالات</div>
                  <div className="font-mono-tabular text-3xl font-bold text-[#202122] mt-1">
                    {articles.length}
                  </div>
                  <div className="text-[11px] text-[#3366cc] mt-1">
                    منها {figuresCount} شخصية وعلم فيلي
                  </div>
                </div>

                <div className="bg-[#fef9e7] border border-[#e2c98d] rounded p-4">
                  <div className="text-xs text-[#613900] flex items-center gap-1 font-semibold">
                    <Sprout className="w-3.5 h-3.5 text-[#ac6600]" aria-hidden="true" />
                    <span>مقالات بذرة (تحتاج إثراءً)</span>
                  </div>
                  <div className="font-mono-tabular text-3xl font-bold text-[#9a5b00] mt-1">
                    {stubArticlesCount}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStubFilter('stub');
                      setPortalFilter('الكل');
                      setActiveSection('pages');
                    }}
                    className="text-[11px] text-[#9a5b00] font-semibold hover:underline mt-1 cursor-pointer"
                  >
                    تصفية مقالات البذرة ←
                  </button>
                </div>

                <div className="bg-white border border-[#a2a9b1] rounded p-4">
                  <div className="text-xs text-[#54595d]">المساهمات المعلقة</div>
                  <div className="font-mono-tabular text-3xl font-bold text-[#ac6600] mt-1">
                    {pendingRevisions.length}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection('contributions')}
                    className="text-[11px] text-[#3366cc] hover:underline mt-1 cursor-pointer"
                  >
                    الانتقال للمراجعة ←
                  </button>
                </div>

                <div className="bg-white border border-[#a2a9b1] rounded p-4">
                  <div className="text-xs text-[#54595d]">آخر التعديلات المسجلة</div>
                  <div className="font-mono-tabular text-3xl font-bold text-[#14866d] mt-1">
                    {latestEdits.length}
                  </div>
                  <div className="text-[11px] text-[#54595d] mt-1">
                    {reviewLog.length} قرار مراجعة في هذه الدورة
                  </div>
                </div>

                <div className="bg-white border border-[#a2a9b1] rounded p-4">
                  <div className="text-xs text-[#54595d]">حسابات المشرفين النشطة</div>
                  <div className="font-mono-tabular text-3xl font-bold text-[#3366cc] mt-1">
                    {members.filter((m) => m.status === 'active').length}
                  </div>
                  <div className="text-[11px] text-[#54595d] mt-1">
                    من أصل {members.length} حساب مسجل
                  </div>
                </div>
              </div>

              {/* لوحة الإحصائيات البصرية التفاعلية (Recharts — أكثر المقالات زيارةً وتفاعلاً خلال الشهر الماضي) */}
              <AdminAnalyticsPanel
                articles={articles}
                articleMetrics={articleMetrics}
                pendingRevisions={pendingRevisions}
                reviewLog={reviewLog}
                onOpenArticle={onOpenArticle}
              />

              {/* توزيع المقالات على البوابات + آخر التعديلات */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <section className="lg:col-span-5 bg-white border border-[#a2a9b1] rounded overflow-hidden">
                  <div className="bg-[#f8f9fa] px-4 py-3 border-b border-[#eaecf0] font-bold text-sm">
                    توزيع المحتوى حسب البوابات
                  </div>
                  <div className="p-4 space-y-3 text-xs">
                    {WIKI_PORTALS.map((portal) => {
                      const count = articles.filter((a) => a.portal === portal.id).length;
                      const pct = Math.round((count / Math.max(articles.length, 1)) * 100);
                      return (
                        <div key={portal.id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#202122]">
                              بوابة {portal.shortLabel}
                            </span>
                            <span className="font-mono-tabular text-[#54595d]">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-[#eaecf0] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#3366cc]"
                              style={{ width: `${Math.max(pct, 4)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="lg:col-span-7 bg-white border border-[#a2a9b1] rounded overflow-hidden">
                  <div className="bg-[#f8f9fa] px-4 py-3 border-b border-[#eaecf0] flex items-center justify-between">
                    <span className="font-bold text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#14866d]" aria-hidden="true" />
                      <span>آخر التعديلات المعتمدة في الموسوعة</span>
                    </span>
                  </div>
                  <div className="divide-y divide-[#eaecf0] text-xs">
                    {latestEdits.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#f8f9fa]"
                      >
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenArticle(ev.articleId)}
                              className="font-bold text-[#3366cc] hover:underline cursor-pointer"
                            >
                              {ev.articleName}
                            </button>
                            <span className="text-[#a2a9b1]">·</span>
                            <span className="text-[#54595d]">{ev.portal}</span>
                          </div>
                          <div className="text-[#202122]">{ev.summary}</div>
                          <div className="text-[11px] text-[#54595d]">
                            بواسطة: <strong>{ev.author}</strong> · اعتُمِد من:{' '}
                            <strong>{ev.approver}</strong>
                          </div>
                        </div>
                        <span className="font-mono-tabular text-[11px] text-[#54595d] shrink-0">
                          {ev.timestamp}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* 2. مراجعة المساهمات المعلقة تحت إشراف الأعضاء */}
          {activeSection === 'contributions' && (
            <div className="space-y-6">
              <div>
                <h1 className="wiki-title text-3xl font-bold text-[#202122]">
                  مراجعة المساهمات وطلبات التسجيل
                </h1>
                <p className="text-xs text-[#54595d] mt-1">
                  فحص الفروقات على مستوى الكلمات وتأكيد الموافقة أو الرفض باسم العضو المشرف النشط ({activeMemberName}).
                </p>
              </div>

              <section className="border border-amber-300 rounded overflow-hidden bg-white">
                <div className="bg-amber-50 px-4 py-3 border-b border-amber-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-950 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-700" aria-hidden="true" />
                    <span>قائمة الانتظار ({pendingRevisions.length})</span>
                  </span>
                  <span className="text-emerald-900 font-semibold">
                    العضو المراجع: {activeMemberName}
                  </span>
                </div>

                {pendingRevisions.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-[#14866d] mx-auto" />
                    <div className="font-bold text-sm">لا توجد مساهمات معلقة حالياً</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12">
                    <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-l border-[#eaecf0] divide-y divide-[#eaecf0] max-h-[540px] overflow-y-auto">
                      {pendingRevisions.map((rev) => (
                        <button
                          key={rev.id}
                          type="button"
                          onClick={() => {
                            setSelectedRevisionId(rev.id);
                            setRejectingId(null);
                            setReasonError('');
                          }}
                          className={`w-full text-right p-3.5 transition cursor-pointer block ${
                            activeRevision?.id === rev.id
                              ? 'bg-[#eaf3ff]'
                              : 'hover:bg-[#f8f9fa]'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span
                              className={`font-bold ${
                                rev.type === 'new_article'
                                  ? 'text-[#3366cc]'
                                  : 'text-[#ac6600]'
                              }`}
                            >
                              {rev.type === 'new_article' ? 'تسجيل صفحة جديدة' : 'تعديل مقترح'}
                            </span>
                            <span className="font-mono-tabular text-[#54595d]">
                              {rev.submittedAt}
                            </span>
                          </div>
                          <div className="font-editorial text-lg font-bold text-[#202122] mt-1">
                            {rev.articleName}
                          </div>
                          <p className="text-xs text-[#54595d] line-clamp-2 mt-0.5">
                            {rev.summary}
                          </p>
                          <div className="text-[11px] text-[#54595d] mt-1">
                            المساهم: <strong>{rev.author}</strong>
                          </div>
                        </button>
                      ))}
                    </div>

                    {activeRevision && (
                      <div className="lg:col-span-8 p-4 space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eaecf0] pb-3">
                          <div>
                            <h2 className="font-editorial text-2xl font-bold text-[#202122]">
                              {activeRevision.articleName}
                            </h2>
                            <div className="text-xs text-[#54595d] mt-1">
                              المساهم: <strong>{activeRevision.author}</strong> ·{' '}
                              {activeRevision.summary}
                            </div>
                          </div>
                          {activeRevision.type === 'edit' && (
                            <button
                              type="button"
                              onClick={() => onOpenArticle(activeRevision.articleId)}
                              className="text-xs text-[#3366cc] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>عرض الصفحة</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {proposedImgUrl && (
                          <div className="bg-[#f8f9fa] border border-[#eaecf0] rounded p-3 flex items-center gap-3">
                            <div className="w-16 h-16 rounded border border-[#a2a9b1] bg-white overflow-hidden flex items-center justify-center shrink-0">
                              <SmartExternalImage
                                imageUrl={proposedImgUrl}
                                alt="معاينة الصورة المقترحة"
                                className="w-full h-full object-cover block"
                                fallback={
                                  <span className="text-[10px] text-[#54595d] text-center px-1">
                                    تعذر العرض
                                  </span>
                                }
                              />
                            </div>
                            <div className="text-xs min-w-0">
                              <div className="font-bold">صورة مرفقة عبر رابط:</div>
                              <div className="text-[#54595d] truncate font-mono-tabular" dir="ltr">
                                {proposedImgUrl}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="space-y-3 max-h-[340px] overflow-y-auto">
                          {diffItems.map((item) => (
                            <div
                              key={item.key}
                              className="border border-[#eaecf0] rounded p-3 bg-[#f8f9fa] space-y-1.5"
                            >
                              <div className="text-xs font-bold text-[#3366cc]">{item.label}</div>
                              <div className="text-xs leading-relaxed whitespace-pre-wrap bg-white p-2.5 rounded border border-[#eaecf0]">
                                {item.tokens.map((tok, idx) =>
                                  tok.type === 'added' ? (
                                    <ins key={idx} className="diff-ins">
                                      {tok.text}
                                    </ins>
                                  ) : tok.type === 'removed' ? (
                                    <del key={idx} className="diff-del">
                                      {tok.text}
                                    </del>
                                  ) : (
                                    <span key={idx}>{tok.text}</span>
                                  )
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="pt-3 border-t border-[#eaecf0] space-y-3">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingId(
                                  rejectingId === activeRevision.id ? null : activeRevision.id
                                );
                                setReasonError('');
                              }}
                              className="px-3.5 py-1.5 bg-white hover:bg-red-50 text-[#d33] border border-red-300 font-bold text-xs rounded flex items-center gap-1.5 cursor-pointer"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>رفض المساهمة</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onApproveRevision(activeRevision.id)}
                              className="px-4 py-1.5 bg-[#14866d] hover:bg-emerald-800 text-white font-bold text-xs rounded flex items-center gap-1.5 cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>
                                {activeRevision.type === 'new_article'
                                  ? 'تأكيد الموافقة وإنشاء الصفحة'
                                  : 'تأكيد الموافقة ونشر التعديل'}
                              </span>
                            </button>
                          </div>

                          {rejectingId === activeRevision.id && (
                            <div className="bg-red-50/50 border border-red-200 rounded p-3 space-y-2 text-xs">
                              <textarea
                                rows={2}
                                value={rejectionReason}
                                onChange={(e) => {
                                  setRejectionReason(e.target.value);
                                  if (reasonError) setReasonError('');
                                }}
                                placeholder="اكتب سبب الرفض ليظهر في السجل..."
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
                                  className="px-3 py-1 text-[#54595d] cursor-pointer"
                                >
                                  إلغاء
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleConfirmReject(activeRevision.id)}
                                  className="px-3.5 py-1 bg-[#d33] text-white font-bold rounded cursor-pointer"
                                >
                                  تأكيد الرفض
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {reviewLog.length > 0 && (
                <section className="bg-white border border-[#a2a9b1] rounded overflow-hidden">
                  <div className="bg-[#f8f9fa] px-4 py-3 border-b border-[#eaecf0] font-bold text-sm">
                    سجل القرارات السابقة ({reviewLog.length})
                  </div>
                  <div className="divide-y divide-[#eaecf0] text-xs">
                    {reviewLog.map((item) => (
                      <div key={item.id} className="p-3.5 flex flex-wrap justify-between gap-2">
                        <div>
                          <span
                            className={`font-bold ${
                              item.status === 'approved' ? 'text-[#14866d]' : 'text-[#d33]'
                            }`}
                          >
                            {item.status === 'approved' ? 'معتمد' : 'مرفوض'}
                          </span>{' '}
                          — <strong>{item.articleName}</strong> ({item.summary})
                          {item.rejectionReason && (
                            <div className="text-[#d33] mt-0.5">
                              سبب الرفض: {item.rejectionReason}
                            </div>
                          )}
                        </div>
                        <div className="font-mono-tabular text-[#54595d]">
                          {item.reviewedBy} · {item.reviewedAt}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* 3. إدارة الصفحات والبوابات */}
          {activeSection === 'pages' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="wiki-title text-3xl font-bold text-[#202122]">
                    إدارة الصفحات والبوابات
                  </h1>
                  <p className="text-xs text-[#54595d] mt-1">
                    لكل صفحة مسجلة في ويكي فيلي لوحة تحكم مستقلة لإدارة صورتها، مشرفيها، ومستوى حمايتها.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* فلتر وسم البذرة وحالة الاكتمال */}
                  <div
                    role="group"
                    aria-label="تصفية حسب وسم البذرة"
                    className="inline-flex items-center bg-white border border-[#a2a9b1] rounded overflow-hidden text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => setStubFilter('all')}
                      className={`px-3 py-2 font-medium transition cursor-pointer ${
                        stubFilter === 'all'
                          ? 'bg-[#3366cc] text-white font-bold'
                          : 'text-[#202122] hover:bg-[#f8f9fa]'
                      }`}
                    >
                      الكل ({articles.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStubFilter('stub')}
                      className={`px-3 py-2 font-medium border-r border-[#eaecf0] inline-flex items-center gap-1 transition cursor-pointer ${
                        stubFilter === 'stub'
                          ? 'bg-[#ac6600] text-white font-bold'
                          : 'text-[#613900] hover:bg-[#fef9e7]'
                      }`}
                    >
                      <Sprout className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>بذرة ({stubArticlesCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStubFilter('complete')}
                      className={`px-3 py-2 font-medium border-r border-[#eaecf0] transition cursor-pointer ${
                        stubFilter === 'complete'
                          ? 'bg-[#14866d] text-white font-bold'
                          : 'text-[#14866d] hover:bg-emerald-50'
                      }`}
                    >
                      مكتملة ({completeArticlesCount})
                    </button>
                  </div>

                  <select
                    value={portalFilter}
                    onChange={(e) => setPortalFilter(e.target.value)}
                    aria-label="تصفية حسب البوابة"
                    className="p-2 text-xs bg-white border border-[#a2a9b1] rounded"
                  >
                    <option value="الكل">جميع البوابات ({articles.length})</option>
                    {WIKI_PORTALS.map((p) => (
                      <option key={p.id} value={p.id}>
                        بوابة {p.shortLabel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {stubFilter === 'stub' && (
                <div className="bg-[#fef9e7] border border-[#e2c98d] border-r-4 border-r-[#ac6600] rounded p-3 text-xs text-[#613900] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sprout className="w-4 h-4 text-[#ac6600] shrink-0" aria-hidden="true" />
                    <span>
                      يتم عرض <strong>المقالات الموسومة كـ «بذرة»</strong> ({filteredPages.length}{' '}
                      مقالة) — وهي المقالات القصيرة أو غير المكتملة التي يظهر أعلى صفحتها تنبيه يشجع الزوار على إثرائها.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStubFilter('all')}
                    className="text-[#3366cc] hover:underline font-semibold cursor-pointer"
                  >
                    عرض جميع المقالات
                  </button>
                </div>
              )}

              <div className="bg-white border border-[#a2a9b1] rounded overflow-x-auto">
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9fa] border-b border-[#eaecf0] text-[#54595d]">
                      <th className="py-2.5 px-4 font-semibold">الصفحة / الشخصية</th>
                      <th className="py-2.5 px-3 font-semibold">البوابة</th>
                      <th className="py-2.5 px-3 font-semibold">الحالة / الوسم</th>
                      <th className="py-2.5 px-3 font-semibold">الحماية</th>
                      <th className="py-2.5 px-3 font-semibold">الأعضاء المشرفون</th>
                      <th className="py-2.5 px-4 font-semibold text-left">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eaecf0]">
                    {filteredPages.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 px-4 text-center text-[#54595d]">
                          لا توجد مقالات مطابقة لخيارات التصفية الحالية.
                        </td>
                      </tr>
                    ) : (
                      filteredPages.map((art) => {
                        const evalInfo =
                          stubEvalMap.get(art.id) ?? evaluateArticleStubStatus(art);
                        return (
                          <tr key={art.id} className="hover:bg-[#f8f9fa]">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <PortraitMedallion
                                  articleId={art.id}
                                  initials={art.initials}
                                  name={art.name}
                                  tone={art.accentTone}
                                  imageUrl={art.imageUrl}
                                  size="sm"
                                />
                                <div>
                                  <div className="font-editorial text-base font-bold text-[#202122]">
                                    {art.name}
                                  </div>
                                  <div className="text-[11px] text-[#54595d]">{art.field}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">{art.portal}</td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              {evalInfo.isStub ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-[#fef9e7] border border-[#e2c98d] text-[#8a5300] font-bold text-[11px]">
                                    <Sprout className="w-3 h-3 text-[#ac6600]" aria-hidden="true" />
                                    <span>بذرة</span>
                                  </span>
                                  <div className="text-[10px] text-[#54595d] font-mono-tabular">
                                    {evalInfo.reason === 'manual' ? 'يدوي' : 'تلقائي'} ·{' '}
                                    {evalInfo.wordCount} كلمة
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-emerald-50 border border-emerald-200 text-[#14866d] font-bold text-[11px]">
                                    <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                                    <span>مكتملة</span>
                                  </span>
                                  <div className="text-[10px] text-[#54595d] font-mono-tabular">
                                    {evalInfo.wordCount} كلمة
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1">
                                <Lock className="w-3 h-3 text-[#3366cc]" />
                                {PROTECTION_LABELS[art.protectionLevel]}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-[11px] text-[#54595d] max-w-xs">
                              {art.designatedApprovers.join(' · ')}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onToggleArticleStub(art.id, !evalInfo.isStub)}
                                  title={
                                    evalInfo.isStub
                                      ? 'إزالة وسم البذرة واعتماد المقالة كمكتملة'
                                      : 'وسم هذه المقالة كـ «بذرة» تحتاج إثراءً'
                                  }
                                  className={`px-2 py-1 border rounded inline-flex items-center gap-1 cursor-pointer transition ${
                                    evalInfo.isStub
                                      ? 'bg-emerald-50 hover:bg-emerald-100 text-[#14866d] border-emerald-300'
                                      : 'bg-[#fef9e7] hover:bg-amber-100 text-[#8a5300] border-[#e2c98d]'
                                  }`}
                                >
                                  <Sprout className="w-3 h-3" aria-hidden="true" />
                                  <span>{evalInfo.isStub ? 'اعتماد كمكتملة' : 'وسم كبذرة'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onOpenArticle(art.id)}
                                  className="px-2.5 py-1 bg-white hover:bg-[#eaf3ff] text-[#3366cc] border border-[#a2a9b1] rounded cursor-pointer"
                                >
                                  عرض
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onOpenPageControl(art.id)}
                                  className="px-2.5 py-1 bg-[#3366cc] hover:bg-[#2a4b8d] text-white rounded inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Settings className="w-3 h-3" />
                                  <span>تحكم الصفحة</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. إدارة الحسابات والأعضاء المشرفين */}
          {activeSection === 'accounts' && (
            <div className="space-y-6">
              <div>
                <h1 className="wiki-title text-3xl font-bold text-[#202122]">
                  إدارة حسابات المشرفين والأعضاء
                </h1>
                <p className="text-xs text-[#54595d] mt-1">
                  إضافة وتفعيل وتعليق حسابات الأعضاء المشرفين على تأكيد المساهمات في ويكي فيلي.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <section className="lg:col-span-8 bg-white border border-[#a2a9b1] rounded overflow-hidden">
                  <div className="bg-[#f8f9fa] px-4 py-3 border-b border-[#eaecf0] font-bold text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#3366cc]" />
                    <span>قائمة الحسابات ({members.length})</span>
                  </div>
                  <div className="divide-y divide-[#eaecf0] text-xs">
                    {members.map((mem) => {
                      const isCurrent = mem.name === activeMemberName;
                      return (
                        <div
                          key={mem.id}
                          className="p-4 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <UserCheck
                                className={`w-4 h-4 ${
                                  mem.status === 'active'
                                    ? 'text-[#14866d]'
                                    : 'text-[#54595d]'
                                }`}
                              />
                              <span className="font-bold text-sm text-[#202122]">
                                {mem.name}
                              </span>
                              <span className="text-[11px] text-[#3366cc] font-semibold">
                                · {mem.roleTitle}
                              </span>
                              {mem.status === 'suspended' && (
                                <span className="text-[11px] text-[#d33] font-bold">
                                  (موقوف)
                                </span>
                              )}
                            </div>
                            <div className="text-[#54595d]">
                              التخصص: {mem.specialty} · تاريخ الانضمام: {mem.joinedAt}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {mem.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => onChangeActiveMember(mem.name)}
                                className={`px-2.5 py-1 rounded border font-semibold cursor-pointer ${
                                  isCurrent
                                    ? 'bg-[#14866d] text-white border-[#14866d]'
                                    : 'bg-white hover:bg-[#eaf3ff] text-[#3366cc] border-[#a2a9b1]'
                                }`}
                              >
                                {isCurrent ? 'الحساب النشط' : 'استخدام للمراجعة'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onToggleMemberStatus(mem.id)}
                              className="px-2.5 py-1 bg-[#f8f9fa] hover:bg-gray-100 border border-[#a2a9b1] rounded cursor-pointer"
                            >
                              {mem.status === 'active' ? 'تعليق' : 'تفعيل'}
                            </button>
                            {members.length > 1 && (
                              <button
                                type="button"
                                onClick={() => onRemoveMember(mem.id)}
                                aria-label={`حذف حساب ${mem.name}`}
                                className="p-1.5 text-[#54595d] hover:text-[#d33] cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="lg:col-span-4 bg-white border border-[#a2a9b1] rounded p-4 space-y-4 text-xs self-start">
                  <h2 className="font-bold text-sm text-[#202122] border-b border-[#eaecf0] pb-2">
                    إنشاء حساب مشرف جديد
                  </h2>
                  <form onSubmit={handleCreateAccount} className="space-y-3">
                    <div>
                      <label htmlFor="acc-name" className="block font-semibold mb-1">
                        الاسم الكامل *
                      </label>
                      <input
                        id="acc-name"
                        type="text"
                        required
                        value={newAccName}
                        onChange={(e) => setNewAccName(e.target.value)}
                        placeholder="مثال: أ. سرمد الفيلي"
                        className="w-full p-2 border border-[#a2a9b1] rounded"
                      />
                    </div>
                    <div>
                      <label htmlFor="acc-role" className="block font-semibold mb-1">
                        الصلاحية / الدور
                      </label>
                      <select
                        id="acc-role"
                        value={newAccRole}
                        onChange={(e) => setNewAccRole(e.target.value)}
                        className="w-full p-2 bg-white border border-[#a2a9b1] rounded"
                      >
                        <option value="مدير النظام">مدير النظام</option>
                        <option value="مشرف بوابة">مشرف بوابة</option>
                        <option value="عضو مراجع">عضو مراجع</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="acc-spec" className="block font-semibold mb-1">
                        التخصص / البوابة
                      </label>
                      <input
                        id="acc-spec"
                        type="text"
                        value={newAccSpecialty}
                        onChange={(e) => setNewAccSpecialty(e.target.value)}
                        placeholder="العشائر، الأماكن، الفنون..."
                        className="w-full p-2 border border-[#a2a9b1] rounded"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-[#3366cc] hover:bg-[#2a4b8d] text-white font-bold rounded flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة الحساب</span>
                    </button>
                  </form>
                </section>
              </div>
            </div>
          )}

          {/* 5. إعدادات النظام العام */}
          {activeSection === 'settings' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h1 className="wiki-title text-3xl font-bold text-[#202122]">
                  إعدادات النظام العام
                </h1>
                <p className="text-xs text-[#54595d] mt-1">
                  ضبط هوية موسوعة ويكي فيلي، سياسة إشراف الأعضاء، الروابط الصورية، والنسخ الاحتياطي.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onUpdateSettings(formSettings);
                }}
                className="bg-white border border-[#a2a9b1] rounded p-5 space-y-4 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="set-name" className="block font-bold mb-1">
                      اسم الموسوعة
                    </label>
                    <input
                      id="set-name"
                      type="text"
                      value={formSettings.siteName}
                      onChange={(e) =>
                        setFormSettings({ ...formSettings, siteName: e.target.value })
                      }
                      className="w-full p-2 border border-[#a2a9b1] rounded"
                    />
                  </div>
                  <div>
                    <label htmlFor="set-sub" className="block font-bold mb-1">
                      الوصف التعريفي أسفل الشعار
                    </label>
                    <input
                      id="set-sub"
                      type="text"
                      value={formSettings.siteSubtitle}
                      onChange={(e) =>
                        setFormSettings({ ...formSettings, siteSubtitle: e.target.value })
                      }
                      className="w-full p-2 border border-[#a2a9b1] rounded"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="set-banner" className="block font-bold mb-1">
                    إعلان شريطي عام للموسوعة (اختياري)
                  </label>
                  <input
                    id="set-banner"
                    type="text"
                    value={formSettings.announcementBanner}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        announcementBanner: e.target.value
                      })
                    }
                    placeholder="يظهر أسفل الترويسة في الصفحات العامة عند كتابة نص هنا..."
                    className="w-full p-2 border border-[#a2a9b1] rounded"
                  />
                </div>

                <div>
                  <label htmlFor="set-prot" className="block font-bold mb-1">
                    مستوى الحماية الافتراضي للصفحات الجديدة
                  </label>
                  <select
                    id="set-prot"
                    value={formSettings.defaultProtectionLevel}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        defaultProtectionLevel: e.target.value as ProtectionLevel
                      })
                    }
                    className="w-full p-2 bg-white border border-[#a2a9b1] rounded"
                  >
                    <option value="semi-protected">محمية جزئياً (بموافقة الأعضاء)</option>
                    <option value="strict-review">مراجعة مشددة</option>
                    <option value="open">مساهمة مفتوحة مع التوثيق</option>
                  </select>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#eaecf0]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formSettings.requireMemberApproval}
                      onChange={(e) =>
                        setFormSettings({
                          ...formSettings,
                          requireMemberApproval: e.target.checked
                        })
                      }
                    />
                    <span>إخضاع جميع المساهمات والتسجيلات الجديدة لموافقة الأعضاء المشرفين</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formSettings.allowImageUrls}
                      onChange={(e) =>
                        setFormSettings({
                          ...formSettings,
                          allowImageUrls: e.target.checked
                        })
                      }
                    />
                    <span>السماح بإضافة الصور الشخصية والتوثيقية عبر رابط خارجي (URL)</span>
                  </label>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#3366cc] hover:bg-[#2a4b8d] text-white font-bold rounded cursor-pointer"
                  >
                    حفظ إعدادات النظام
                  </button>
                </div>
              </form>

              {/* النسخ الاحتياطي للبيانات */}
              <div className="bg-white border border-[#a2a9b1] rounded p-5 space-y-4 text-xs">
                <h2 className="font-bold text-sm text-[#202122]">
                  النسخ الاحتياطي وإدارة قاعدة البيانات المحلية
                </h2>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onExportJson}
                    className="px-3.5 py-2 bg-[#f8f9fa] hover:bg-[#eaf3ff] border border-[#a2a9b1] rounded font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>تصدير نسخة كاملة (JSON)</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 bg-[#f8f9fa] hover:bg-[#eaf3ff] border border-[#a2a9b1] rounded font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>استيراد ملف JSON</span>
                  </button>

                  {!confirmReset ? (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="px-3.5 py-2 text-[#d33] border border-red-200 hover:bg-red-50 rounded font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>استعادة البيانات الافتراضية</span>
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded">
                      <button
                        type="button"
                        onClick={() => {
                          onResetDefaults();
                          setConfirmReset(false);
                        }}
                        className="text-[#d33] font-bold hover:underline cursor-pointer"
                      >
                        تأكيد الاستعادة
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="text-[#54595d] cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
