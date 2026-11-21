import { ArticleSnapshot, inferArticleType, isEffectiveStub } from '../types/encyclopedia';

export interface DiffToken {
  type: 'equal' | 'added' | 'removed';
  text: string;
}

export interface FieldDiffItem {
  key: string;
  label: string;
  oldValue: string;
  newValue: string;
  hasChanges: boolean;
  tokens: DiffToken[];
}

function tokenizeForDiff(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/\S+|\s+/g);
  return matches ?? [];
}

export function computeWordDiff(oldText: string, newText: string): DiffToken[] {
  if (oldText === newText) {
    return oldText ? [{ type: 'equal', text: oldText }] : [];
  }

  const oldTokens = tokenizeForDiff(oldText);
  const newTokens = tokenizeForDiff(newText);

  if (oldTokens.length === 0) {
    return [{ type: 'added', text: newText }];
  }
  if (newTokens.length === 0) {
    return [{ type: 'removed', text: oldText }];
  }

  if (oldTokens.length * newTokens.length > 900_000) {
    return [
      { type: 'removed', text: oldText },
      { type: 'added', text: newText }
    ];
  }

  const m = oldTokens.length;
  const n = newTokens.length;
  const dp: Uint32Array[] = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldTokens[i] === newTokens[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = dp[i + 1][j] >= dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1];
      }
    }
  }

  const rawTokens: DiffToken[] = [];
  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (oldTokens[i] === newTokens[j]) {
      rawTokens.push({ type: 'equal', text: oldTokens[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rawTokens.push({ type: 'removed', text: oldTokens[i] });
      i++;
    } else {
      rawTokens.push({ type: 'added', text: newTokens[j] });
      j++;
    }
  }

  while (i < m) {
    rawTokens.push({ type: 'removed', text: oldTokens[i] });
    i++;
  }

  while (j < n) {
    rawTokens.push({ type: 'added', text: newTokens[j] });
    j++;
  }

  const merged: DiffToken[] = [];
  for (const tok of rawTokens) {
    const prev = merged[merged.length - 1];
    if (prev && prev.type === tok.type) {
      prev.text += tok.text;
    } else {
      merged.push({ ...tok });
    }
  }

  return merged;
}

export function buildDiffComparison(
  original: ArticleSnapshot | undefined,
  proposed: ArticleSnapshot
): FieldDiffItem[] {
  const emptySnapshot: ArticleSnapshot = {
    name: '',
    subtitle: '',
    portal: proposed.portal ?? 'شخصيات وأعلام',
    articleType: proposed.articleType ?? inferArticleType(proposed),
    summary: '',
    field: '',
    activeYears: '',
    birthDate: '',
    deathDate: '',
    birthDeath: '',
    birthplace: '',
    clanAffiliation: '',
    geographicLocation: '',
    administrativeRegion: '',
    coordinates: '',
    populationEstimate: '',
    relatedClans: '',
    historicalEra: '',
    notableWorks: '',
    imageUrl: '',
    imageCaption: '',
    categories: [],
    subcategories: [],
    sections: [],
    references: []
  };

  const base = original ?? emptySnapshot;
  const proposedType = inferArticleType(proposed);
  const originalType = original ? inferArticleType(original) : proposedType;

  const typeLabel = (t: string | undefined) =>
    t === 'person' ? 'شخصية' : t === 'place' ? 'منطقة' : 'موضوع عام / عشيرة / حدث';

  const scalarFields: Array<{ key: keyof ArticleSnapshot; label: string }> = [
    { key: 'name', label: 'العنوان / الاسم الكامل' },
    { key: 'subtitle', label: 'الوصف التعريفي' },
    { key: 'portal', label: 'البوابة الموسوعية' },
    { key: 'articleType', label: 'نوع المقال' },
    { key: 'field', label: 'المجال / التصنيف' },
    ...(proposedType === 'person' || originalType === 'person'
      ? [
          { key: 'birthDate' as const, label: 'تاريخ الميلاد' },
          { key: 'deathDate' as const, label: 'تاريخ الوفاة' },
          { key: 'birthDeath' as const, label: 'الميلاد / الوفاة' },
          { key: 'birthplace' as const, label: 'مكان الميلاد والنشأة' },
          { key: 'clanAffiliation' as const, label: 'الانتماء العشائري / العائلي' }
        ]
      : []),
    ...(proposedType === 'place' || originalType === 'place'
      ? [
          { key: 'geographicLocation' as const, label: 'الموقع الجغرافي' },
          { key: 'administrativeRegion' as const, label: 'المحافظة / الإقليم / الدولة' },
          { key: 'coordinates' as const, label: 'الإحداثيات الجغرافية' },
          { key: 'populationEstimate' as const, label: 'التقدير السكاني' },
          { key: 'relatedClans' as const, label: 'العشائر والأعلام المرتبطة' }
        ]
      : []),
    ...(proposedType === 'general' || originalType === 'general'
      ? [{ key: 'historicalEra' as const, label: 'الحقبة الزمنية / العمق التاريخي' }]
      : []),
    { key: 'activeYears', label: 'سنوات الامتداد / النشاط' },
    { key: 'notableWorks', label: 'أبرز الأعمال والمعالم' },
    { key: 'imageUrl', label: 'رابط الصورة (URL)' },
    { key: 'imageCaption', label: 'تعليق الصورة' },
    { key: 'summary', label: 'المقدمة التعريفية' }
  ];

  const items: FieldDiffItem[] = scalarFields.map(({ key, label }) => {
    const rawOld =
      key === 'articleType' ? typeLabel(originalType) : String(base[key] ?? '').trim();
    const rawNew =
      key === 'articleType' ? typeLabel(proposedType) : String(proposed[key] ?? '').trim();
    const hasChanges = rawOld !== rawNew;
    return {
      key,
      label,
      oldValue: rawOld,
      newValue: rawNew,
      hasChanges,
      tokens: hasChanges ? computeWordDiff(rawOld, rawNew) : [{ type: 'equal', text: rawNew }]
    };
  });

  const oldCats = base.categories.join('، ');
  const newCats = proposed.categories.join('، ');
  items.push({
    key: 'categories',
    label: 'التصنيفات الرئيسية',
    oldValue: oldCats,
    newValue: newCats,
    hasChanges: oldCats !== newCats,
    tokens: oldCats !== newCats ? computeWordDiff(oldCats, newCats) : [{ type: 'equal', text: newCats }]
  });

  const oldSubcats = (base.subcategories ?? []).join('، ');
  const newSubcats = (proposed.subcategories ?? []).join('، ');
  items.push({
    key: 'subcategories',
    label: 'التصنيفات الفرعية',
    oldValue: oldSubcats,
    newValue: newSubcats,
    hasChanges: oldSubcats !== newSubcats,
    tokens:
      oldSubcats !== newSubcats
        ? computeWordDiff(oldSubcats, newSubcats)
        : [{ type: 'equal', text: newSubcats }]
  });

  const oldStubLabel = original
    ? isEffectiveStub(original)
      ? 'موسومة كبذرة (مقالة قصيرة تحتاج إثراءً)'
      : 'مقالة مكتملة'
    : '';
  const newStubLabel = isEffectiveStub(proposed)
    ? 'موسومة كبذرة (مقالة قصيرة تحتاج إثراءً)'
    : 'مقالة مكتملة';
  items.push({
    key: 'isStub',
    label: 'وسم البذرة وحالة الاكتمال',
    oldValue: oldStubLabel,
    newValue: newStubLabel,
    hasChanges: oldStubLabel !== newStubLabel,
    tokens:
      oldStubLabel !== newStubLabel
        ? computeWordDiff(oldStubLabel, newStubLabel)
        : [{ type: 'equal', text: newStubLabel }]
  });

  const matchedOldIds = new Set<string>();

  proposed.sections.forEach((propSec, idx) => {
    const matchingOld =
      base.sections.find((s) => s.id === propSec.id && !matchedOldIds.has(s.id)) ??
      (base.sections[idx] && !matchedOldIds.has(base.sections[idx].id) ? base.sections[idx] : undefined);

    if (matchingOld) {
      matchedOldIds.add(matchingOld.id);
    }

    const oldSectionText = matchingOld ? `${matchingOld.title}\n${matchingOld.content}` : '';
    const newSectionText = `${propSec.title}\n${propSec.content}`;
    const hasChanges = oldSectionText.trim() !== newSectionText.trim();

    items.push({
      key: `section-${propSec.id}-${idx}`,
      label: `قسم: ${propSec.title || `قسم ${idx + 1}`}`,
      oldValue: oldSectionText,
      newValue: newSectionText,
      hasChanges,
      tokens: hasChanges
        ? computeWordDiff(oldSectionText, newSectionText)
        : [{ type: 'equal', text: newSectionText }]
    });
  });

  base.sections.forEach((oldSec, idx) => {
    if (!matchedOldIds.has(oldSec.id)) {
      const oldSectionText = `${oldSec.title}\n${oldSec.content}`;
      items.push({
        key: `section-removed-${oldSec.id}-${idx}`,
        label: `قسم محذوف: ${oldSec.title}`,
        oldValue: oldSectionText,
        newValue: '',
        hasChanges: true,
        tokens: [{ type: 'removed', text: oldSectionText }]
      });
    }
  });

  const oldRefs = base.references.map((r) => `[${r.id}] ${r.text}`).join('\n');
  const newRefs = proposed.references.map((r) => `[${r.id}] ${r.text}`).join('\n');
  items.push({
    key: 'references',
    label: 'المصادر والمراجع',
    oldValue: oldRefs,
    newValue: newRefs,
    hasChanges: oldRefs !== newRefs,
    tokens: oldRefs !== newRefs ? computeWordDiff(oldRefs, newRefs) : [{ type: 'equal', text: newRefs }]
  });

  return items;
}
