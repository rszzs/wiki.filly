import { Article } from '../types/encyclopedia';

export interface TocSubheading {
  id: string;
  level: 3 | 4;
  number: string;
  title: string;
}

export interface TocSectionItem {
  id: string;
  sectionIndex: number;
  number: string;
  title: string;
  children: TocSubheading[];
}

export interface ArticleTocModel {
  items: TocSectionItem[];
  referencesItem: {
    id: string;
    number: string;
    title: string;
  };
  allAnchorIds: string[];
  sectionAnchorByIndex: string[];
  totalEntriesCount: number;
  shouldShowInlineToc: boolean;
}

function cleanHeadingText(raw: string): string {
  return raw
    .replace(/'''([\s\S]+?)'''/g, '$1')
    .replace(/''([\s\S]+?)''/g, '$1')
    .replace(/\[\[([^\]|]+?)\|([^\]]+?)\]\]/g, '$2')
    .replace(/\[\[([^\]]+?)\]\]/g, '$1')
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeAnchorBase(rawId: string | undefined, fallbackIndex: number): string {
  const cleaned = (rawId ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!cleaned) {
    return `sec-${fallbackIndex + 1}`;
  }
  return cleaned;
}

export function extractSectionSubheadings(
  content: string
): Array<{ level: 3 | 4; title: string }> {
  const lines = content.split('\n');
  const found: Array<{ level: 3 | 4; title: string }> = [];
  let inTable = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('{|')) {
      inTable = true;
      continue;
    }
    if (inTable) {
      if (trimmed.startsWith('|}')) {
        inTable = false;
      }
      continue;
    }

    const h4Match = /^====\s*(.+?)\s*====$/.exec(trimmed);
    if (h4Match) {
      found.push({ level: 4, title: cleanHeadingText(h4Match[1]) });
      continue;
    }

    const h3Match = /^===\s*(.+?)\s*===$/.exec(trimmed);
    if (h3Match) {
      found.push({ level: 3, title: cleanHeadingText(h3Match[1]) });
    }
  }

  return found;
}

export function buildArticleToc(article: Article): ArticleTocModel {
  const usedIds = new Set<string>(['sec-intro', 'sec-references']);
  const sectionAnchorByIndex: string[] = [];
  const items: TocSectionItem[] = [];
  const allAnchorIds: string[] = ['sec-intro'];

  let subheadingTotal = 0;
  let totalContentChars = article.summary.trim().length;

  article.sections.forEach((section, idx) => {
    totalContentChars += section.title.trim().length + section.content.trim().length;

    const baseId = sanitizeAnchorBase(section.id, idx);
    let uniqueId = baseId;
    let suffix = 2;
    while (usedIds.has(uniqueId)) {
      uniqueId = `${baseId}-${suffix++}`;
    }
    usedIds.add(uniqueId);
    sectionAnchorByIndex.push(uniqueId);
    allAnchorIds.push(uniqueId);

    const rawSubs = extractSectionSubheadings(section.content);
    let h3Counter = 0;
    let h4Counter = 0;
    const children: TocSubheading[] = rawSubs.map((sub, subIdx) => {
      const subId = `${uniqueId}-sub-${subIdx + 1}`;
      usedIds.add(subId);
      allAnchorIds.push(subId);
      subheadingTotal++;

      let number: string;
      if (sub.level === 3) {
        h3Counter += 1;
        h4Counter = 0;
        number = `${idx + 1}.${h3Counter}`;
      } else {
        if (h3Counter === 0) h3Counter = 1;
        h4Counter += 1;
        number = `${idx + 1}.${h3Counter}.${h4Counter}`;
      }

      return {
        id: subId,
        level: sub.level,
        number,
        title: sub.title
      };
    });

    items.push({
      id: uniqueId,
      sectionIndex: idx,
      number: String(idx + 1),
      title: cleanHeadingText(section.title) || `القسم ${idx + 1}`,
      children
    });
  });

  const referencesItem = {
    id: 'sec-references',
    number: String(article.sections.length + 1),
    title: 'المراجع والمصادر'
  };
  allAnchorIds.push(referencesItem.id);

  // Automatic threshold for displaying the inline Table of Contents:
  // Show for articles with 2+ sections, or long 1-section articles with subheadings / substantial text.
  const shouldShowInlineToc =
    article.sections.length >= 2 ||
    (article.sections.length >= 1 && (subheadingTotal > 0 || totalContentChars >= 550));

  const totalEntriesCount = items.length + subheadingTotal + 1;

  return {
    items,
    referencesItem,
    allAnchorIds,
    sectionAnchorByIndex,
    totalEntriesCount,
    shouldShowInlineToc
  };
}

export function scrollToTocAnchor(anchorId: string, updateHash = true): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const target = document.getElementById(anchorId);
  if (!target) return false;

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
    block: 'start'
  });

  if (updateHash) {
    try {
      const nextUrl = `${window.location.pathname}${window.location.search}#${encodeURIComponent(
        anchorId
      )}`;
      window.history.replaceState(null, '', nextUrl);
    } catch {
      // Ignore restricted history contexts
    }
  }

  return true;
}
