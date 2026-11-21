import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  FilePlus2,
  Image as ImageIcon,
  MapPin,
  Plus,
  Sprout,
  Tag,
  Tags,
  Trash2,
  User,
  X
} from 'lucide-react';
import {
  AccentTone,
  Article,
  ArticleSnapshot,
  ArticleType,
  MemberAccount,
  PORTAL_SUBCATEGORY_SUGGESTIONS,
  ProtectionLevel,
  SystemSettings,
  WIKI_PORTALS,
  WikiPortal,
  formatPersonLifespan,
  getPlaceLocationSummary
} from '../types/encyclopedia';
import { suggestCategoriesFromSummary } from '../utils/categorySuggester';
import { validateImageUrl } from '../utils/storage';
import { ImageLoadStatus, SmartExternalImage } from './PortraitMedallion';

interface NewArticleModalProps {
  isOpen: boolean;
  isAdminSession: boolean;
  isSignedIn?: boolean;
  userDisplayName?: string | null;
  onSignIn?: () => void;
  existingArticles?: Article[];
  members: MemberAccount[];
  activeMemberName: string;
  settings: SystemSettings;
  onClose: () => void;
  onSubmitNewArticle: (payload: {
    snapshot: ArticleSnapshot;
    author: string;
    accentTone: AccentTone;
    designatedApprovers: string[];
    protectionLevel: ProtectionLevel;
    publishDirectly: boolean;
  }) => void;
}

export function NewArticleModal({
  isOpen,
  isAdminSession,
  isSignedIn = true,
  userDisplayName,
  onSignIn,
  existingArticles = [],
  members,
  activeMemberName,
  settings,
  onClose,
  onSubmitNewArticle
}: NewArticleModalProps) {
  const [entryType, setEntryType] = useState<ArticleType | null>(null);

  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [portal, setPortal] = useState<WikiPortal>('شخصيات وأعلام');
  const [field, setField] = useState('');
  const [activeYears, setActiveYears] = useState('');
  const [notableWorks, setNotableWorks] = useState('');

  // حقول خاصة بـ «شخصية» فقط
  const [birthDate, setBirthDate] = useState('');
  const [deathDate, setDeathDate] = useState('');
  const [birthplace, setBirthplace] = useState('');
  const [clanAffiliation, setClanAffiliation] = useState('');

  // حقول خاصة بـ «منطقة» فقط
  const [geographicLocation, setGeographicLocation] = useState('');
  const [administrativeRegion, setAdministrativeRegion] = useState('');
  const [coordinates, setCoordinates] = useState('');
  const [populationEstimate, setPopulationEstimate] = useState('');
  const [relatedClans, setRelatedClans] = useState('');

  // حقل خاص بـ «موضوع عام / عشيرة / حدث» فقط
  const [historicalEra, setHistoricalEra] = useState('');

  const [imageUrl, setImageUrl] = useState('');
  const [imageCaption, setImageCaption] = useState('');
  const [categoriesText, setCategoriesText] = useState('');
  const [subcategoriesText, setSubcategoriesText] = useState('');
  const [approversText, setApproversText] = useState(
    () => members[0]?.name ?? activeMemberName
  );
  const [protectionLevel, setProtectionLevel] = useState<ProtectionLevel>(
    settings.defaultProtectionLevel
  );
  const [summary, setSummary] = useState('');
  const [sectionTitle, setSectionTitle] = useState('النبذة والتاريخ');
  const [sectionContent, setSectionContent] = useState('');
  const [references, setReferences] = useState<string[]>(['']);
  const [author, setAuthor] = useState('');
  const [accentTone, setAccentTone] = useState<AccentTone>('lapis');
  const [isStubFlag, setIsStubFlag] = useState(false);
  const [publishDirectly, setPublishDirectly] = useState(true);
  const [error, setError] = useState('');
  const [previewStatus, setPreviewStatus] = useState<ImageLoadStatus>('idle');

  const imageValidation = useMemo(() => validateImageUrl(imageUrl), [imageUrl]);
  const safePreviewUrl = settings.allowImageUrls ? imageValidation.sanitized : '';

  const keywordSuggestions = useMemo(
    () =>
      suggestCategoriesFromSummary({
        summary,
        title: name,
        subtitle,
        field,
        articleType: entryType,
        portal,
        existingArticles
      }),
    [summary, name, subtitle, field, entryType, portal, existingArticles]
  );

  useEffect(() => {
    if (!safePreviewUrl) {
      setPreviewStatus('idle');
    }
  }, [safePreviewUrl]);

  useEffect(() => {
    if (isOpen) {
      setProtectionLevel(settings.defaultProtectionLevel);
      setEntryType(null);
      setError('');
    }
  }, [isOpen, settings.defaultProtectionLevel]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectEntryType = (nextType: ArticleType) => {
    setEntryType(nextType);
    setError('');
    if (nextType === 'person') {
      setPortal('شخصيات وأعلام');
      setField((prev) =>
        !prev || prev === 'الجغرافيا التاريخية والمدن' || prev === 'التراث والتاريخ الفيلي'
          ? 'الأدب والثقافة والعلوم'
          : prev
      );
      setSectionTitle((prev) =>
        !prev || prev === 'الموقع الجغرافي والتاريخ' || prev === 'النبذة والتاريخ'
          ? 'النشأة والمسيرة'
          : prev
      );
      setAccentTone('lapis');
    } else if (nextType === 'place') {
      setPortal('أماكن ومدن');
      setField((prev) =>
        !prev || prev === 'الأدب والثقافة والعلوم' || prev === 'التراث والتاريخ الفيلي'
          ? 'الجغرافيا التاريخية والمدن'
          : prev
      );
      setSectionTitle((prev) =>
        !prev || prev === 'النشأة والمسيرة' || prev === 'النبذة والتاريخ'
          ? 'الموقع الجغرافي والتاريخ'
          : prev
      );
      setAccentTone('forest');
    } else {
      setPortal('عشائر وأنساب');
      setField((prev) =>
        !prev || prev === 'الأدب والثقافة والعلوم' || prev === 'الجغرافيا التاريخية والمدن'
          ? 'التراث والتاريخ الفيلي'
          : prev
      );
      setSectionTitle('النبذة والتاريخ');
      setAccentTone('bronze');
    }
  };

  const resetFormFields = () => {
    setEntryType(null);
    setName('');
    setSubtitle('');
    setField('');
    setActiveYears('');
    setNotableWorks('');
    setBirthDate('');
    setDeathDate('');
    setBirthplace('');
    setClanAffiliation('');
    setGeographicLocation('');
    setAdministrativeRegion('');
    setCoordinates('');
    setPopulationEstimate('');
    setRelatedClans('');
    setHistoricalEra('');
    setImageUrl('');
    setImageCaption('');
    setCategoriesText('');
    setSubcategoriesText('');
    setSummary('');
    setSectionTitle('النبذة والتاريخ');
    setSectionContent('');
    setReferences(['']);
    setIsStubFlag(false);
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryType) {
      setError('يرجى تحديد نوع المقال أولاً (شخصية أو منطقة أو موضوع عام).');
      return;
    }
    if (!isSignedIn) {
      setError('يرجى تسجيل الدخول عبر Google أولاً لإرسال المقال.');
      return;
    }
    if (name.trim().length < 2 || field.trim().length < 2 || summary.trim().length < 5) {
      setError(
        'يرجى تعبئة الحقول الأساسية: العنوان والمجال (حرفان على الأقل) والمقدمة التعريفية (5 أحرف على الأقل).'
      );
      return;
    }

    if (settings.allowImageUrls && !imageValidation.valid) {
      setError(
        imageValidation.error ??
          'رابط الصورة غير صالح. يرجى إدخال رابط يبدأ بـ https:// أو http://.'
      );
      return;
    }

    const parsedCats = categoriesText
      .split(/[،,]/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (parsedCats.length === 0) {
      parsedCats.push(field.trim());
    }

    const parsedSubcats = Array.from(
      new Set(
        subcategoriesText
          .split(/[،,]/)
          .map((s) => s.trim())
          .filter(Boolean)
      )
    ).slice(0, 20);

    const parsedApprovers = approversText
      .split(/[،,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const cleanedRefs = references
      .map((r) => r.trim())
      .filter(Boolean)
      .map((text, idx) => ({ id: idx + 1, text }));

    const sections = sectionContent.trim()
      ? [
          {
            id: `sec-${Date.now()}`,
            title: sectionTitle.trim() || 'التفاصيل والتوثيق',
            content: sectionContent.trim()
          }
        ]
      : [];

    const trimmedName = name.trim();
    const trimmedSubtitle = subtitle.trim() || `${field.trim()} — ${portal}`;
    const trimmedField = field.trim();
    const trimmedActiveYears = activeYears.trim() || 'غير محدد';
    const trimmedNotableWorks = notableWorks.trim() || 'قيد التوثيق';

    const shouldPublishDirectly =
      isAdminSession && (publishDirectly || !settings.requireMemberApproval);

    const snapshot: ArticleSnapshot = {
      name: trimmedName,
      subtitle: trimmedSubtitle,
      portal,
      articleType: entryType,
      field: trimmedField,
      activeYears: trimmedActiveYears,
      notableWorks: trimmedNotableWorks,
      // تعبئة الحقول المخصصة حسب نوع المقال بدقة
      birthDate: entryType === 'person' ? birthDate.trim() : '',
      deathDate: entryType === 'person' ? deathDate.trim() : '',
      birthDeath:
        entryType === 'person'
          ? formatPersonLifespan({ birthDate: birthDate.trim(), deathDate: deathDate.trim() }) ||
            'غير محدد'
          : '',
      birthplace:
        entryType === 'person'
          ? birthplace.trim() || 'غير محدد'
          : entryType === 'place'
            ? getPlaceLocationSummary({
                geographicLocation: geographicLocation.trim(),
                administrativeRegion: administrativeRegion.trim()
              }) || 'غير محدد'
            : '',
      clanAffiliation: entryType === 'person' ? clanAffiliation.trim() : '',
      geographicLocation: entryType === 'place' ? geographicLocation.trim() : '',
      administrativeRegion: entryType === 'place' ? administrativeRegion.trim() : '',
      coordinates: entryType === 'place' ? coordinates.trim() : '',
      populationEstimate: entryType === 'place' ? populationEstimate.trim() : '',
      relatedClans: entryType === 'place' ? relatedClans.trim() : '',
      historicalEra: entryType === 'general' ? historicalEra.trim() : '',
      imageUrl: safePreviewUrl,
      imageCaption: imageCaption.trim() || `${trimmedName} — ${trimmedSubtitle}`,
      summary: summary.trim(),
      categories: parsedCats,
      subcategories: parsedSubcats,
      ...(isStubFlag ? { isStub: true } : {}),
      sections,
      references: cleanedRefs
    };

    onSubmitNewArticle({
      author:
        author.trim() ||
        (isAdminSession ? activeMemberName : userDisplayName || 'باحث مساهم'),
      accentTone,
      designatedApprovers:
        parsedApprovers.length > 0 ? parsedApprovers : [activeMemberName],
      protectionLevel,
      publishDirectly: shouldPublishDirectly,
      snapshot
    });

    resetFormFields();
    onClose();
  };

  const isPerson = entryType === 'person';
  const isPlace = entryType === 'place';
  const isGeneral = entryType === 'general';

  const selectedMainCategories = categoriesText
    .split(/[،,]/)
    .map((c) => c.trim())
    .filter(Boolean);

  const toggleMainCategory = (cat: string) => {
    const exists = selectedMainCategories.includes(cat);
    const next = exists
      ? selectedMainCategories.filter((item) => item !== cat)
      : [...selectedMainCategories, cat];
    setCategoriesText(next.join('، '));
  };

  const selectedNewSubcats = subcategoriesText
    .split(/[،,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const toggleNewSubcategory = (sub: string) => {
    const exists = selectedNewSubcats.includes(sub);
    const next = exists
      ? selectedNewSubcats.filter((item) => item !== sub)
      : [...selectedNewSubcats, sub];
    setSubcategoriesText(next.join('، '));
  };

  const unappliedSuggestedCategories = keywordSuggestions.categories.filter(
    (item) => !selectedMainCategories.includes(item.label)
  );
  const unappliedSuggestedSubcategories = keywordSuggestions.subcategories.filter(
    (item) => !selectedNewSubcats.includes(item.label)
  );
  const totalUnappliedSuggestions =
    unappliedSuggestedCategories.length + unappliedSuggestedSubcategories.length;

  const applyAllSuggestedCategories = () => {
    if (unappliedSuggestedCategories.length > 0) {
      const nextCats = Array.from(
        new Set([
          ...selectedMainCategories,
          ...unappliedSuggestedCategories.map((item) => item.label)
        ])
      );
      setCategoriesText(nextCats.join('، '));
    }
    if (unappliedSuggestedSubcategories.length > 0) {
      const nextSubs = Array.from(
        new Set([
          ...selectedNewSubcats,
          ...unappliedSuggestedSubcategories.map((item) => item.label)
        ])
      );
      setSubcategoriesText(nextSubs.join('، '));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-article-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg border border-[#a2a9b1] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        <div className="bg-[#f8f9fa] px-5 py-3.5 border-b border-[#eaecf0] flex items-center justify-between">
          <div>
            <h2
              id="new-article-modal-title"
              className="wiki-title text-xl font-bold text-[#202122] flex items-center gap-2"
            >
              <FilePlus2 className="w-5 h-5 text-[#3366cc]" aria-hidden="true" />
              <span>إضافة مقال جديد في {settings.siteName}</span>
            </h2>
            <p className="text-[11px] text-[#54595d] mt-0.5">
              اختر نوع المقال (شخص أو منطقة) لتظهر حقول المعلومات المخصصة لتسجيله وتوثيقه.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="p-1.5 text-[#54595d] hover:text-[#202122] rounded cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-[#d33] rounded">
              {error}
            </div>
          )}

          {/* الخطوة 1: اختيار نوع المقال (شخص أم منطقة) */}
          <div className="bg-[#f8f9fa] border border-[#a2a9b1]/80 rounded p-3.5 space-y-2.5">
            <div className="font-bold text-sm text-[#202122]">
              1. حدد تصنيف المقال المراد إضافته *
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectEntryType('person')}
                aria-pressed={isPerson}
                className={`p-3 rounded border text-right transition cursor-pointer flex items-start gap-2.5 ${
                  isPerson
                    ? 'bg-[#eaf3ff] border-[#3366cc] ring-1 ring-[#3366cc]'
                    : 'bg-white border-[#a2a9b1] hover:bg-[#f8f9fa]'
                }`}
              >
                <User
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    isPerson ? 'text-[#3366cc]' : 'text-[#54595d]'
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-[#202122] flex items-center justify-between gap-1">
                    <span>شخص</span>
                    {isPerson && (
                      <CheckCircle2 className="w-4 h-4 text-[#3366cc] shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#54595d] mt-0.5 leading-snug">
                    أعلام، شعراء، مؤرخون، أكاديميون، أو شخصيات عامة
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectEntryType('place')}
                aria-pressed={isPlace}
                className={`p-3 rounded border text-right transition cursor-pointer flex items-start gap-2.5 ${
                  isPlace
                    ? 'bg-[#eaf3ff] border-[#3366cc] ring-1 ring-[#3366cc]'
                    : 'bg-white border-[#a2a9b1] hover:bg-[#f8f9fa]'
                }`}
              >
                <MapPin
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    isPlace ? 'text-[#3366cc]' : 'text-[#54595d]'
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-[#202122] flex items-center justify-between gap-1">
                    <span>منطقة</span>
                    {isPlace && (
                      <CheckCircle2 className="w-4 h-4 text-[#3366cc] shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#54595d] mt-0.5 leading-snug">
                    مدن، أقضية، قرى، محلات تاريخية، أو معالم جغرافية
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectEntryType('general')}
                aria-pressed={entryType === 'general'}
                className={`p-3 rounded border text-right transition cursor-pointer flex items-start gap-2.5 ${
                  entryType === 'general'
                    ? 'bg-[#eaf3ff] border-[#3366cc] ring-1 ring-[#3366cc]'
                    : 'bg-white border-[#a2a9b1] hover:bg-[#f8f9fa]'
                }`}
              >
                <BookOpen
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    entryType === 'general' ? 'text-[#3366cc]' : 'text-[#54595d]'
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-[#202122] flex items-center justify-between gap-1">
                    <span>عشيرة / موضوع</span>
                    {entryType === 'general' && (
                      <CheckCircle2 className="w-4 h-4 text-[#3366cc] shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#54595d] mt-0.5 leading-snug">
                    عشائر، أحداث تاريخية، فنون، أو مواضيع تراثية أخرى
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* الخطوة 2: تظهر المعلومات المطلوب تسجيلها بعد التحديد */}
          {!entryType ? (
            <div className="p-6 text-center bg-white border border-dashed border-[#a2a9b1] rounded text-[#54595d] space-y-2">
              <p className="font-semibold text-[#202122] text-sm">
                يرجى اختيار «شخص» أو «منطقة» أعلاه لعرض الحقول والمعلومات المخصصة لتسجيل المقال.
              </p>
              <p className="text-xs">
                تتغير حقول بطاقة البيانات الموسوعية تلقائياً بما يناسب توثيق الشخصيات أو المناطق الجغرافية.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#eaecf0] pb-2">
                <h3 className="font-bold text-sm text-[#3366cc]">
                  {isPerson
                    ? '2. معلومات الشخصية المراد تسجيلها'
                    : isPlace
                      ? '2. معلومات المنطقة أو المدينة المراد تسجيلها'
                      : '2. معلومات المقالة المراد تسجيلها'}
                </h3>
                <span className="text-[11px] text-[#54595d]">
                  الحقول المميزة بـ (*) مطلوبة
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="new-name" className="block font-bold mb-1">
                    {isPerson
                      ? 'الاسم الكامل للشخصية *'
                      : isPlace
                        ? 'اسم المنطقة أو المدينة *'
                        : 'عنوان المقالة / الموضوع *'}
                  </label>
                  <input
                    id="new-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      isPerson
                        ? 'مثال: د. جعفر الفيلي، الشاعر غلام رضا خان...'
                        : isPlace
                          ? 'مثال: قضاء خانقين، مندلي، ناحية قزانية...'
                          : 'مثال: عشيرة الأركوازي، فن الهوره...'
                    }
                    className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                  />
                </div>

                <div>
                  <label htmlFor="new-portal" className="block font-bold mb-1">
                    البوابة في ويكي فيلي *
                  </label>
                  <select
                    id="new-portal"
                    value={portal}
                    onChange={(e) => setPortal(e.target.value as WikiPortal)}
                    className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                  >
                    {WIKI_PORTALS.map((p) => (
                      <option key={p.id} value={p.id}>
                        بوابة {p.shortLabel}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="new-subtitle" className="block font-bold mb-1">
                    {isPerson
                      ? 'الصفة / اللقب العلمي أو المهني'
                      : isPlace
                        ? 'الصفة الجغرافية (قضاء، قرية، محلة...)'
                        : 'الوصف المختصر / التعريف'}
                  </label>
                  <input
                    id="new-subtitle"
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder={
                      isPerson
                        ? 'مثال: شاعر كلاسيكي / عالم نفس وتربوي / إعلامي'
                        : isPlace
                          ? 'مثال: مدينة حدودية تاريخية على ضفاف نهر الوند'
                          : 'مثال: عشيرة كردية فيلية عريقة'
                    }
                    className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                  />
                </div>

                <div>
                  <label htmlFor="new-field" className="block font-bold mb-1">
                    {isPerson
                      ? 'التخصص / المجال *'
                      : isPlace
                        ? 'التصنيف الجغرافي / المجال *'
                        : 'المجال / التصنيف الموضوعي *'}
                  </label>
                  <input
                    id="new-field"
                    type="text"
                    required
                    value={field}
                    onChange={(e) => setField(e.target.value)}
                    placeholder={
                      isPerson
                        ? 'مثال: الأدب والشعر، العلوم والتربية، الإعلام...'
                        : isPlace
                          ? 'مثال: الجغرافيا التاريخية والمدن'
                          : 'العشائر، الفنون، الأحداث التاريخية...'
                    }
                    className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                  />
                </div>

                {/* حقول مخصصة للمقالات من نوع «شخصية» فقط: الميلاد والوفاة والموطن والعشيرة */}
                {isPerson && (
                  <>
                    <div>
                      <label htmlFor="new-birthDate" className="block font-bold mb-1">
                        تاريخ الميلاد
                      </label>
                      <input
                        id="new-birthDate"
                        type="text"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        placeholder="مثال: 1938 أو 15 آذار 1938"
                        className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                      />
                    </div>

                    <div>
                      <label htmlFor="new-deathDate" className="block font-bold mb-1">
                        تاريخ الوفاة (اختياري)
                      </label>
                      <input
                        id="new-deathDate"
                        type="text"
                        value={deathDate}
                        onChange={(e) => setDeathDate(e.target.value)}
                        placeholder="اتركه فارغاً للأحياء — مثال: 2014"
                        className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                      />
                    </div>

                    <div>
                      <label htmlFor="new-birthplace" className="block font-bold mb-1">
                        مكان الميلاد والنشأة
                      </label>
                      <input
                        id="new-birthplace"
                        type="text"
                        value={birthplace}
                        onChange={(e) => setBirthplace(e.target.value)}
                        placeholder="مثال: خانقين / بغداد / مندلي / إيلام"
                        className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                      />
                    </div>

                    <div>
                      <label htmlFor="new-clanAffiliation" className="block font-bold mb-1">
                        الانتماء العشائري / العائلي (اختياري)
                      </label>
                      <input
                        id="new-clanAffiliation"
                        type="text"
                        value={clanAffiliation}
                        onChange={(e) => setClanAffiliation(e.target.value)}
                        placeholder="مثال: عشيرة الأركوازي / الزنكنة / الكلهور"
                        className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                      />
                    </div>
                  </>
                )}

                {/* حقول مخصصة للمقالات من نوع «منطقة» فقط: الموقع الجغرافي والإقليم والإحداثيات */}
                {isPlace && (
                  <>
                    <div>
                      <label htmlFor="new-geographicLocation" className="block font-bold mb-1">
                        الموقع الجغرافي
                      </label>
                      <input
                        id="new-geographicLocation"
                        type="text"
                        value={geographicLocation}
                        onChange={(e) => setGeographicLocation(e.target.value)}
                        placeholder="مثال: شرق العراق على ضفاف نهر الوند، سفوح زاغروس"
                        className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                      />
                    </div>

                    <div>
                      <label htmlFor="new-administrativeRegion" className="block font-bold mb-1">
                        المحافظة / الإقليم / الدولة
                      </label>
                      <input
                        id="new-administrativeRegion"
                        type="text"
                        value={administrativeRegion}
                        onChange={(e) => setAdministrativeRegion(e.target.value)}
                        placeholder="مثال: محافظة ديالى، العراق"
                        className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                      />
                    </div>

                    <div>
                      <label htmlFor="new-coordinates" className="block font-bold mb-1">
                        الإحداثيات الجغرافية (اختياري)
                      </label>
                      <input
                        id="new-coordinates"
                        type="text"
                        dir="ltr"
                        value={coordinates}
                        onChange={(e) => setCoordinates(e.target.value)}
                        placeholder="34.3483° N, 45.3906° E"
                        className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                      />
                    </div>

                    <div>
                      <label htmlFor="new-populationEstimate" className="block font-bold mb-1">
                        التقدير السكاني (اختياري)
                      </label>
                      <input
                        id="new-populationEstimate"
                        type="text"
                        value={populationEstimate}
                        onChange={(e) => setPopulationEstimate(e.target.value)}
                        placeholder="مثال: نحو 150,000 نسمة"
                        className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="new-relatedClans" className="block font-bold mb-1">
                        العشائر والأعلام المرتبطة بالمنطقة (اختياري)
                      </label>
                      <input
                        id="new-relatedClans"
                        type="text"
                        value={relatedClans}
                        onChange={(e) => setRelatedClans(e.target.value)}
                        placeholder="مثال: الأركوازي، السورميري، باجلان، الكلهور..."
                        className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                      />
                    </div>
                  </>
                )}

                {/* حقل مخصص للموضوعات العامة والعشائر والأحداث */}
                {isGeneral && (
                  <div className="sm:col-span-2">
                    <label htmlFor="new-historicalEra" className="block font-bold mb-1">
                      الحقبة التاريخية / العمق الزمني
                    </label>
                    <input
                      id="new-historicalEra"
                      type="text"
                      value={historicalEra}
                      onChange={(e) => setHistoricalEra(e.target.value)}
                      placeholder="مثال: ممتدة منذ العصور الوسطى حتى العصر الحاضر"
                      className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="new-activeYears" className="block font-bold mb-1">
                    {isPerson
                      ? 'سنوات النشاط / المسيرة'
                      : isPlace
                        ? 'الامتداد التاريخي / الوضع الحالي'
                        : 'الحقبة / سنوات الامتداد'}
                  </label>
                  <input
                    id="new-activeYears"
                    type="text"
                    value={activeYears}
                    onChange={(e) => setActiveYears(e.target.value)}
                    placeholder={
                      isPerson
                        ? 'مثال: 1962 – 2014 أو باحث معاصر'
                        : isPlace
                          ? 'مثال: مدينة قائمة ومأهولة منذ قرون'
                          : 'مثال: ممتدة عبر العصور'
                    }
                    className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                  />
                </div>

                <div>
                  <label htmlFor="new-works" className="block font-bold mb-1">
                    {isPerson
                      ? 'أبرز المؤلفات أو الإنجازات والمناصب'
                      : isPlace
                        ? 'أبرز المعالم والأنهار والقرى التابعة'
                        : 'أبرز المعالم / المحطات'}
                  </label>
                  <input
                    id="new-works"
                    type="text"
                    value={notableWorks}
                    onChange={(e) => setNotableWorks(e.target.value)}
                    placeholder={
                      isPerson
                        ? 'مثال: الدواوين الشعرية، الأبحاث، المناصب العلمية...'
                        : isPlace
                          ? 'مثال: نهر الوند، بساتين النخيل، القرى المحيطة...'
                          : 'أهم الأعمال أو المعالم المرتبطة...'
                    }
                    className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                  />
                </div>
              </div>

              {/* إضافة صورة عن طريق رابط */}
              {settings.allowImageUrls && (
                <div className="bg-[#f8f9fa] border border-[#eaecf0] rounded p-3.5 space-y-3">
                  <div className="font-bold text-[#202122] flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-[#3366cc]" aria-hidden="true" />
                    <span>
                      {isPerson
                        ? 'صورة الشخصية عبر رابط (اختياري)'
                        : isPlace
                          ? 'صورة المنطقة أو المعلم عبر رابط (اختياري)'
                          : 'صورة المقال عبر رابط (اختياري)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="new-image-url" className="block font-semibold mb-1">
                        رابط الصورة
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id="new-image-url"
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
                      <label htmlFor="new-image-caption" className="block font-semibold mb-1">
                        وصف / تعليق الصورة
                      </label>
                      <input
                        id="new-image-caption"
                        type="text"
                        value={imageCaption}
                        onChange={(e) => setImageCaption(e.target.value)}
                        placeholder="وصف يظهر أسفل الصورة في صندوق المعلومات"
                        className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                      />
                    </div>
                  </div>
                  {safePreviewUrl && (
                    <div className="flex items-center gap-3 pt-1 bg-white border border-[#eaecf0] rounded p-2.5">
                      <div className="w-16 h-16 rounded border border-[#a2a9b1] bg-[#f8f9fa] overflow-hidden flex items-center justify-center shrink-0">
                        <SmartExternalImage
                          imageUrl={safePreviewUrl}
                          alt="معاينة الصورة"
                          onStatusChange={setPreviewStatus}
                          className="w-full h-full object-cover block"
                          fallback={
                            <ImageIcon className="w-6 h-6 text-[#a2a9b1]" aria-hidden="true" />
                          }
                        />
                      </div>
                      <div className="space-y-1 min-w-0">
                        {previewStatus === 'loaded' && (
                          <div className="text-[#14866d] text-[11px] font-medium">
                            تم تحميل الصورة بنجاح وجاهزة للعرض في المقال.
                          </div>
                        )}
                        {previewStatus === 'loading' && (
                          <div className="text-[#54595d] text-[11px]">
                            جارٍ اختبار وتحميل معاينة الصورة من الرابط...
                          </div>
                        )}
                        {previewStatus === 'error' && (
                          <div className="text-[#ac6600] text-[11px] leading-relaxed">
                            تعذّر تحميل معاينة الصورة من هذا الرابط (قد يكون رابط صفحة ويب وليس رابط صورة مباشر أو محمياً من العرض الخارجي). انقر بالزر الأيمن على الصورة واختر «نسخ عنوان الصورة».
                          </div>
                        )}
                        <div
                          className="text-[10px] text-[#54595d] font-mono-tabular truncate"
                          dir="ltr"
                        >
                          {safePreviewUrl}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="new-summary" className="block font-bold mb-1">
                  المقدمة التعريفية / ملخص المقال * (استخدم [1] للإحالة إلى المرجع الأول)
                </label>
                <textarea
                  id="new-summary"
                  rows={3}
                  required
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder={
                    isPerson
                      ? 'اكتب نبذة تعريفية موثقة عن الشخصية ومسيرتها... (تُستخلص منها اقتراحات التصنيف تلقائياً)'
                      : isPlace
                        ? 'اكتب نبذة جغرافية وتاريخية موثقة عن المنطقة... (تُستخلص منها اقتراحات التصنيف تلقائياً)'
                        : 'نبذة موسوعية مركزة وموثقة... (تُستخلص منها اقتراحات التصنيف تلقائياً)'
                  }
                  className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                />
              </div>

              {/* لوحة اقتراح التصنيفات تلقائياً بناءً على الكلمات المفتاحية في ملخص المقال */}
              <div className="bg-[#f4f8ff] border border-[#b7cff5] rounded p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-[#202122] flex items-center gap-1.5">
                    <Tags className="w-4 h-4 text-[#3366cc]" aria-hidden="true" />
                    <span>اقتراحات التصنيف التلقائية من ملخص المقال</span>
                  </div>
                  {totalUnappliedSuggestions > 0 && (
                    <button
                      type="button"
                      onClick={applyAllSuggestedCategories}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#3366cc] hover:bg-[#2a4b8d] text-white text-[11px] font-bold rounded transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>إضافة كل المقترحات ({totalUnappliedSuggestions})</span>
                    </button>
                  )}
                </div>

                {summary.trim().length < 8 ? (
                  <p className="text-[11px] text-[#54595d]">
                    اكتب ملخص المقال أعلاه ليتم تحليل الكلمات المفتاحية واقتراح التصنيفات الرئيسية والفرعية المناسبة تلقائياً.
                  </p>
                ) : keywordSuggestions.categories.length === 0 &&
                  keywordSuggestions.subcategories.length === 0 ? (
                  <p className="text-[11px] text-[#54595d]">
                    لم تُرصد كلمات مفتاحية تصنيفية واضحة بعد — أضف تفاصيل مثل المجال أو المدينة أو العشيرة أو الحقبة في الملخص لظهور الاقتراحات.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {keywordSuggestions.extractedKeywords.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#54595d]">
                        <span className="font-semibold text-[#202122]">
                          الكلمات المفتاحية المرصودة:
                        </span>
                        {keywordSuggestions.extractedKeywords.map((kw) => (
                          <span
                            key={kw}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-[#d6e2f5] text-[#2a4b8d] rounded text-[10px]"
                          >
                            <Tag className="w-2.5 h-2.5" aria-hidden="true" />
                            <span>{kw}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {keywordSuggestions.categories.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold text-[#2a4b8d]">
                          تصنيفات رئيسية مقترحة (انقر للإضافة أو الإزالة):
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {keywordSuggestions.categories.map((item) => {
                            const active = selectedMainCategories.includes(item.label);
                            return (
                              <button
                                key={item.label}
                                type="button"
                                onClick={() => toggleMainCategory(item.label)}
                                title={
                                  item.matchedKeywords.length > 0
                                    ? `مقترح بناءً على: ${item.matchedKeywords.join('، ')}`
                                    : undefined
                                }
                                className={`px-2.5 py-1 text-[11px] rounded border transition cursor-pointer ${
                                  active
                                    ? 'bg-[#3366cc] text-white border-[#3366cc] font-bold'
                                    : 'bg-white text-[#202122] border-[#a7c1ec] hover:border-[#3366cc] hover:text-[#3366cc]'
                                }`}
                              >
                                {active ? '✓ ' : '+ '}
                                {item.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {keywordSuggestions.subcategories.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-[#d6e2f5]">
                        <div className="text-[11px] font-semibold text-[#14866d]">
                          تصنيفات فرعية مقترحة من الملخص:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {keywordSuggestions.subcategories.map((item) => {
                            const active = selectedNewSubcats.includes(item.label);
                            return (
                              <button
                                key={item.label}
                                type="button"
                                onClick={() => toggleNewSubcategory(item.label)}
                                title={
                                  item.matchedKeywords.length > 0
                                    ? `مقترح بناءً على: ${item.matchedKeywords.join('، ')}`
                                    : undefined
                                }
                                className={`px-2 py-0.5 text-[11px] rounded border transition cursor-pointer ${
                                  active
                                    ? 'bg-[#14866d] text-white border-[#14866d] font-bold'
                                    : 'bg-white text-[#14866d] border-[#9fd5c8] hover:border-[#14866d] hover:bg-[#e8f5f1]'
                                }`}
                              >
                                {active ? '✓ ' : '+ '}
                                {item.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {keywordSuggestions.suggestedPortal && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#d6e2f5] text-[11px]">
                        <span className="text-[#54595d]">
                          وفق الكلمات المفتاحية، قد يكون المقال مناسباً أيضاً لـ{' '}
                          <strong className="text-[#202122]">
                            بوابة {keywordSuggestions.suggestedPortal}
                          </strong>
                          .
                        </span>
                        <button
                          type="button"
                          onClick={() => setPortal(keywordSuggestions.suggestedPortal!)}
                          className="text-[#3366cc] hover:underline font-bold cursor-pointer"
                        >
                          تبديل البوابة
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="new-cats" className="block font-bold mb-1">
                    التصنيفات الرئيسية (مفصولة بفاصلة)
                  </label>
                  <input
                    id="new-cats"
                    type="text"
                    value={categoriesText}
                    onChange={(e) => setCategoriesText(e.target.value)}
                    placeholder={
                      isPerson
                        ? 'أعلام خانقين، شعراء، أدب وتاريخ'
                        : isPlace
                          ? 'أماكن ومدن، محافظة ديالى، حواضر فيلية'
                          : 'عشائر العراق، تراث فيلي'
                    }
                    className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                  />
                </div>
                <div>
                  <label htmlFor="new-protection" className="block font-bold mb-1">
                    نظام إشراف المقال
                  </label>
                  <select
                    id="new-protection"
                    value={protectionLevel}
                    onChange={(e) => setProtectionLevel(e.target.value as ProtectionLevel)}
                    className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                  >
                    <option value="semi-protected">محمية جزئياً (بموافقة الأعضاء)</option>
                    <option value="strict-review">مراجعة مشددة (اعتماد مزدوج)</option>
                    <option value="open">مساهمة مفتوحة مع التوثيق</option>
                  </select>
                </div>
              </div>

              {/* التصنيفات الفرعية مع اقتراحات تفاعلية حسب البوابة */}
              <div className="bg-[#f8f9fa] border border-[#eaecf0] rounded p-3 space-y-2">
                <label htmlFor="new-subcats" className="block font-bold text-[#14866d]">
                  التصنيفات الفرعية (اختياري — مفصولة بفاصلة)
                </label>
                <input
                  id="new-subcats"
                  type="text"
                  value={subcategoriesText}
                  onChange={(e) => setSubcategoriesText(e.target.value)}
                  placeholder="أضف تصنيفات فرعية دقيقة أو اختر من الاقتراحات أدناه..."
                  className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:outline-none focus:border-[#14866d]"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-[#54595d]">
                    اقتراحات بوابة {portal}:
                  </span>
                  {PORTAL_SUBCATEGORY_SUGGESTIONS[portal].map((sub) => {
                    const active = selectedNewSubcats.includes(sub);
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => toggleNewSubcategory(sub)}
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

              {isAdminSession && (
                <div>
                  <label htmlFor="new-approvers" className="block font-bold mb-1">
                    الأعضاء المشرفون المعينون على هذا المقال
                  </label>
                  <input
                    id="new-approvers"
                    type="text"
                    value={approversText}
                    onChange={(e) => setApproversText(e.target.value)}
                    placeholder="افصل بفاصلة بين أسماء المشرفين"
                    className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="new-sec-title" className="block font-bold mb-1">
                    عنوان القسم الأول
                  </label>
                  <input
                    id="new-sec-title"
                    type="text"
                    value={sectionTitle}
                    onChange={(e) => setSectionTitle(e.target.value)}
                    className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="new-sec-body" className="block font-bold mb-1">
                    نص القسم الأول
                  </label>
                  <textarea
                    id="new-sec-body"
                    rows={3}
                    value={sectionContent}
                    onChange={(e) => setSectionContent(e.target.value)}
                    placeholder={
                      isPerson
                        ? 'تفاصيل النشأة، التعليم، المحطات العلمية أو الإبداعية...'
                        : isPlace
                          ? 'تفاصيل الموقع الجغرافي، التاريخ، القرى والمعالم...'
                          : 'تفاصيل ومعلومات القسم الأول...'
                    }
                    className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold">المراجع والمصادر</span>
                  <button
                    type="button"
                    onClick={() => setReferences([...references, ''])}
                    className="inline-flex items-center gap-1 text-[#3366cc] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>إضافة مرجع</span>
                  </button>
                </div>
                {references.map((refVal, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="font-mono-tabular text-[#54595d] w-7">[{idx + 1}]</span>
                    <input
                      type="text"
                      value={refVal}
                      onChange={(e) => {
                        const next = [...references];
                        next[idx] = e.target.value;
                        setReferences(next);
                      }}
                      placeholder="بيانات الكتاب أو الوثيقة أو الرابط..."
                      className="flex-1 p-1.5 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                    />
                    {references.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setReferences(references.filter((_, i) => i !== idx))}
                        aria-label="حذف المرجع"
                        className="p-1 text-[#54595d] hover:text-[#d33] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#eaecf0]">
                <div>
                  <label htmlFor="new-author" className="block font-bold mb-1">
                    اسم المساهم / كاتب المقال
                  </label>
                  <input
                    id="new-author"
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder={
                      isAdminSession
                        ? activeMemberName
                        : userDisplayName || 'اسمك أو صفتك البحثية'
                    }
                    className="w-full p-2 border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                  />
                </div>
                <div>
                  <label htmlFor="new-tone" className="block font-bold mb-1">
                    لون الشعار الاحتياطي (عند عدم وجود صورة)
                  </label>
                  <select
                    id="new-tone"
                    value={accentTone}
                    onChange={(e) => setAccentTone(e.target.value as AccentTone)}
                    className="w-full p-2 bg-white border border-[#a2a9b1] rounded focus:outline-none focus:border-[#3366cc]"
                  >
                    <option value="lapis">أزرق موسوعي</option>
                    <option value="bronze">برونزي تراثي</option>
                    <option value="forest">أخضر زيتي</option>
                    <option value="terracotta">بني طيني</option>
                  </select>
                </div>
              </div>

              <label className="flex items-start gap-2.5 text-xs text-[#613900] bg-[#fef9e7] border border-[#e2c98d] p-2.5 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={isStubFlag}
                  onChange={(e) => setIsStubFlag(e.target.checked)}
                  className="mt-0.5 rounded border-[#c7a75b] text-[#ac6600]"
                />
                <span>
                  <strong className="inline-flex items-center gap-1">
                    <Sprout className="w-3.5 h-3.5 text-[#ac6600]" aria-hidden="true" />
                    <span>وسم المقالة كـ «بذرة» (مقالة قصيرة تحتاج إثراءً)</span>
                  </strong>
                  <span className="block text-[11px] text-[#7a4b00] mt-0.5">
                    يُظهر تنبيهاً مرئياً أعلى المقالة لتشجيع الزوار على تطويرها (كما تُوسم المقالات القصيرة تلقائياً كبذرة).
                  </span>
                </span>
              </label>

              {isAdminSession && (
                <label className="flex items-center gap-2 text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 p-2.5 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={publishDirectly}
                    onChange={(e) => setPublishDirectly(e.target.checked)}
                    className="rounded border-emerald-400 text-[#14866d]"
                  />
                  <span>
                    تأكيد الموافقة ونشر المقال مباشرة باسم المشرف ({activeMemberName})
                  </span>
                </label>
              )}

              {!isSignedIn && onSignIn && (
                <div className="bg-blue-50 border border-[#a7d7f9] rounded p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-[#202122]">
                    لتوثيق المقال وإرساله إلى قاعدة البيانات، يرجى تسجيل الدخول بحساب Google أولاً.
                  </span>
                  <button
                    type="button"
                    onClick={onSignIn}
                    className="px-3.5 py-1.5 bg-[#3366cc] hover:bg-[#2a4b8d] text-white font-bold rounded cursor-pointer shrink-0"
                  >
                    تسجيل الدخول عبر Google
                  </button>
                </div>
              )}

              {isSignedIn && userDisplayName && !isAdminSession && (
                <div className="text-[11px] text-[#54595d]">
                  مسجل حالياً باسم: <strong className="text-[#202122]">{userDisplayName}</strong>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-[#eaecf0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#a2a9b1] rounded hover:bg-gray-100 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={!isSignedIn || !entryType}
              className={`px-5 py-2 font-bold rounded ${
                isSignedIn && entryType
                  ? 'bg-[#3366cc] hover:bg-[#2a4b8d] text-white cursor-pointer'
                  : 'bg-[#eaecf0] text-[#72777d] cursor-not-allowed'
              }`}
            >
              {isAdminSession && (publishDirectly || !settings.requireMemberApproval)
                ? 'نشر المقال وتفعيل لوحة تحكمه'
                : 'إرسال المقال لمراجعة الأعضاء'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
