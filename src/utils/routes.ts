import type React from 'react';
import { WIKI_PORTALS, WikiPortal } from '../types/encyclopedia';

export type ArticleTabRoute = 'read' | 'edit' | 'history' | 'talk' | 'control';

export type ParsedWikiRoute =
  | { kind: 'home' }
  | {
      kind: 'directory';
      portal: WikiPortal | 'الكل';
      category: string;
      subcategory: string;
    }
  | { kind: 'article'; articleId: string; tab: ArticleTabRoute }
  | { kind: 'admin' };

const VALID_ARTICLE_TABS: ArticleTabRoute[] = ['read', 'edit', 'history', 'talk', 'control'];

export function getPortalSlug(portal: WikiPortal): string {
  const found = WIKI_PORTALS.find((p) => p.id === portal);
  return found ? found.slug : encodeURIComponent(portal);
}

export function resolvePortalFromSlug(rawSlug: string): WikiPortal | null {
  let decoded = rawSlug;
  try {
    decoded = decodeURIComponent(rawSlug).trim();
  } catch {
    decoded = rawSlug.trim();
  }
  const lower = decoded.toLowerCase();
  const bySlug = WIKI_PORTALS.find((p) => p.slug === lower);
  if (bySlug) return bySlug.id;

  const normalizedArabic = decoded.replace(/-/g, ' ');
  const byArabic = WIKI_PORTALS.find(
    (p) => p.id === decoded || p.id === normalizedArabic || p.shortLabel === normalizedArabic
  );
  return byArabic ? byArabic.id : null;
}

export function encodeCategorySlug(category: string): string {
  return encodeURIComponent(category.trim().replace(/\s+/g, '-'));
}

export function decodeCategorySlug(rawSlug: string, knownCategories?: string[]): string {
  let decoded = rawSlug;
  try {
    decoded = decodeURIComponent(rawSlug).trim();
  } catch {
    decoded = rawSlug.trim();
  }

  if (knownCategories && knownCategories.length > 0) {
    const exact = knownCategories.find((c) => c === decoded);
    if (exact) return exact;

    const withSpaces = decoded.replace(/-/g, ' ');
    const matchedSpaces = knownCategories.find((c) => c === withSpaces);
    if (matchedSpaces) return matchedSpaces;

    const matchedSlug = knownCategories.find(
      (c) => c.trim().replace(/\s+/g, '-') === decoded
    );
    if (matchedSlug) return matchedSlug;
  }

  return decoded.replace(/-/g, ' ');
}

export function getHomePath(): string {
  return '/';
}

export function getDirectoryPath(): string {
  return '/directory';
}

export function getPortalPath(portal: WikiPortal | 'الكل'): string {
  if (portal === 'الكل') return getDirectoryPath();
  return `/portal/${getPortalSlug(portal)}`;
}

export function getCategoryPath(category: string, portal: WikiPortal | 'الكل' = 'الكل'): string {
  const trimmed = category.trim();
  if (!trimmed || trimmed === 'الكل') {
    return getPortalPath(portal);
  }
  const catSlug = encodeCategorySlug(trimmed);
  if (portal !== 'الكل') {
    return `/portal/${getPortalSlug(portal)}/category/${catSlug}`;
  }
  return `/category/${catSlug}`;
}

export function getSubcategoryPath(
  subcategory: string,
  portal: WikiPortal | 'الكل' = 'الكل',
  category: string = 'الكل'
): string {
  const trimmedSub = subcategory.trim();
  if (!trimmedSub || trimmedSub === 'الكل') {
    return getCategoryPath(category, portal);
  }
  const subSlug = encodeCategorySlug(trimmedSub);
  const hasCat = category.trim().length > 0 && category !== 'الكل';

  if (portal !== 'الكل' && hasCat) {
    return `/portal/${getPortalSlug(portal)}/category/${encodeCategorySlug(category)}/subcategory/${subSlug}`;
  }
  if (portal !== 'الكل') {
    return `/portal/${getPortalSlug(portal)}/subcategory/${subSlug}`;
  }
  if (hasCat) {
    return `/category/${encodeCategorySlug(category)}/subcategory/${subSlug}`;
  }
  return `/subcategory/${subSlug}`;
}

export function getArticlePath(articleId: string, tab: ArticleTabRoute = 'read'): string {
  const base = `/article/${encodeURIComponent(articleId)}`;
  if (tab && tab !== 'read') {
    return `${base}?tab=${tab}`;
  }
  return base;
}

export function getAdminPath(): string {
  return '/admin';
}

export function getAbsoluteUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${window.location.origin}${normalized}`;
}

export function parseRouteFromLocation(
  knownCategories?: string[],
  knownSubcategories?: string[]
): ParsedWikiRoute {
  if (typeof window === 'undefined') {
    return { kind: 'home' };
  }

  const pathname = window.location.pathname || '/';
  const lowerPath = pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const params = new URLSearchParams(window.location.search);

  if (
    lowerPath === '/admin' ||
    lowerPath.startsWith('/admin/') ||
    hash.startsWith('#/admin') ||
    params.get('admin') === '1'
  ) {
    return { kind: 'admin' };
  }

  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return { kind: 'home' };
  }

  const first = segments[0].toLowerCase();

  if (first === 'article' && segments[1]) {
    let articleId = segments[1];
    try {
      articleId = decodeURIComponent(segments[1]);
    } catch {
      articleId = segments[1];
    }
    const rawTab = (params.get('tab') ?? 'read').toLowerCase() as ArticleTabRoute;
    const tab: ArticleTabRoute = VALID_ARTICLE_TABS.includes(rawTab) ? rawTab : 'read';
    return { kind: 'article', articleId, tab };
  }

  if (first === 'portal' && segments[1]) {
    const portal = resolvePortalFromSlug(segments[1]) ?? 'الكل';
    if (segments[2]?.toLowerCase() === 'category' && segments[3]) {
      const category = decodeCategorySlug(segments[3], knownCategories);
      if (segments[4]?.toLowerCase() === 'subcategory' && segments[5]) {
        const subcategory = decodeCategorySlug(segments[5], knownSubcategories);
        return { kind: 'directory', portal, category, subcategory };
      }
      return { kind: 'directory', portal, category, subcategory: 'الكل' };
    }
    if (segments[2]?.toLowerCase() === 'subcategory' && segments[3]) {
      const subcategory = decodeCategorySlug(segments[3], knownSubcategories);
      return { kind: 'directory', portal, category: 'الكل', subcategory };
    }
    return { kind: 'directory', portal, category: 'الكل', subcategory: 'الكل' };
  }

  if (first === 'category' && segments[1]) {
    const category = decodeCategorySlug(segments[1], knownCategories);
    if (segments[2]?.toLowerCase() === 'subcategory' && segments[3]) {
      const subcategory = decodeCategorySlug(segments[3], knownSubcategories);
      return { kind: 'directory', portal: 'الكل', category, subcategory };
    }
    return { kind: 'directory', portal: 'الكل', category, subcategory: 'الكل' };
  }

  if (first === 'subcategory' && segments[1]) {
    const subcategory = decodeCategorySlug(segments[1], knownSubcategories);
    return { kind: 'directory', portal: 'الكل', category: 'الكل', subcategory };
  }

  if (first === 'directory' || first === 'portals' || first === 'categories') {
    return { kind: 'directory', portal: 'الكل', category: 'الكل', subcategory: 'الكل' };
  }

  return { kind: 'home' };
}

export function pushRoutePath(path: string, replace = false): void {
  if (typeof window === 'undefined') return;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === path) return;
  try {
    if (replace) {
      window.history.replaceState({}, '', path);
    } else {
      window.history.pushState({}, '', path);
    }
  } catch {
    // Ignore restricted history API contexts
  }
}

export function shouldHandleClientNavigation(
  e: React.MouseEvent<HTMLAnchorElement>
): boolean {
  return (
    !e.defaultPrevented &&
    e.button === 0 &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.shiftKey &&
    !e.altKey
  );
}
