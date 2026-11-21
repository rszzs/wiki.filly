import { stripWikitext } from '../components/CitationText';
import {
  Article,
  SystemSettings,
  WIKI_PORTALS,
  WikiPortal,
  formatPersonLifespan,
  getEffectiveSubcategories,
  getPlaceLocationSummary,
  inferArticleType
} from '../types/encyclopedia';
import {
  getAbsoluteUrl,
  getArticlePath,
  getCategoryPath,
  getDirectoryPath,
  getHomePath,
  getPortalPath,
  getSubcategoryPath
} from './routes';

import archivalBannerUrl from '../assets/images/archival_encyclopedia_banner_1795254534693.jpg';

const DEFAULT_OG_IMAGE_PATH = archivalBannerUrl;

function truncateMeta(text: string, maxLen = 158): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  const sliced = cleaned.slice(0, maxLen - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  return `${(lastSpace > 80 ? sliced.slice(0, lastSpace) : sliced).trim()}…`;
}

function upsertMetaTag(
  attrName: 'name' | 'property',
  attrValue: string,
  content: string
): void {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attrName}="${attrValue}"]`
  );
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonicalLink(href: string): void {
  if (typeof document === 'undefined') return;
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function upsertJsonLd(data: Record<string, unknown>): void {
  if (typeof document === 'undefined') return;
  let script = document.getElementById('wiki-feyli-jsonld') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'wiki-feyli-jsonld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

function parseCoordinates(raw?: string): { latitude: number; longitude: number } | null {
  if (!raw) return null;
  const match = raw.match(
    /(-?\d+(?:\.\d+)?)\s*°?\s*([NS])?[,\s/]+(-?\d+(?:\.\d+)?)\s*°?\s*([EW])?/i
  );
  if (!match) return null;
  let lat = Number(match[1]);
  let lng = Number(match[3]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (match[2]?.toUpperCase() === 'S') lat = -Math.abs(lat);
  if (match[4]?.toUpperCase() === 'W') lng = -Math.abs(lng);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

export type SeoPageDescriptor =
  | { kind: 'home'; articles: Article[] }
  | {
      kind: 'directory';
      portal: WikiPortal | 'الكل';
      category: string;
      subcategory?: string;
      filteredArticles: Article[];
    }
  | { kind: 'article'; article: Article }
  | { kind: 'admin' };

export function applySeoMetadata(
  descriptor: SeoPageDescriptor,
  settings: SystemSettings
): void {
  if (typeof document === 'undefined') return;

  const siteName = settings.siteName || 'ويكي فيلي';
  const defaultImage = getAbsoluteUrl(DEFAULT_OG_IMAGE_PATH);

  if (descriptor.kind === 'admin') {
    const title = `لوحة الإدارة — ${siteName}`;
    const description = `بوابة الإشراف والمراجعة المركزية لموسوعة ${siteName}.`;
    const canonical = getAbsoluteUrl('/admin');

    document.title = title;
    upsertMetaTag('name', 'description', description);
    upsertMetaTag('name', 'robots', 'noindex, nofollow');
    upsertCanonicalLink(canonical);
    upsertMetaTag('property', 'og:type', 'website');
    upsertMetaTag('property', 'og:site_name', siteName);
    upsertMetaTag('property', 'og:locale', 'ar_IQ');
    upsertMetaTag('property', 'og:title', title);
    upsertMetaTag('property', 'og:description', description);
    upsertMetaTag('property', 'og:url', canonical);
    upsertMetaTag('property', 'og:image', defaultImage);
    upsertMetaTag('name', 'twitter:card', 'summary');
    upsertMetaTag('name', 'twitter:title', title);
    upsertMetaTag('name', 'twitter:description', description);
    return;
  }

  upsertMetaTag('name', 'robots', 'index, follow');

  if (descriptor.kind === 'home') {
    const title = `${siteName} — الموسوعة التوثيقية الحرة للأكراد الفيليين`;
    const description = truncateMeta(
      `${siteName}: ${settings.siteSubtitle}. تصفح ${descriptor.articles.length} مقالة موثقة في ${WIKI_PORTALS.length} بوابات تشمل الشخصيات والعشائر والمدن والفنون والتاريخ.`
    );
    const canonical = getAbsoluteUrl(getHomePath());

    document.title = title;
    upsertMetaTag('name', 'description', description);
    upsertCanonicalLink(canonical);
    upsertMetaTag('property', 'og:type', 'website');
    upsertMetaTag('property', 'og:site_name', siteName);
    upsertMetaTag('property', 'og:locale', 'ar_IQ');
    upsertMetaTag('property', 'og:title', title);
    upsertMetaTag('property', 'og:description', description);
    upsertMetaTag('property', 'og:url', canonical);
    upsertMetaTag('property', 'og:image', defaultImage);
    upsertMetaTag('name', 'twitter:card', 'summary_large_image');
    upsertMetaTag('name', 'twitter:title', title);
    upsertMetaTag('name', 'twitter:description', description);
    upsertMetaTag('name', 'twitter:image', defaultImage);

    upsertJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          name: siteName,
          alternateName: settings.siteSubtitle,
          url: canonical,
          inLanguage: 'ar',
          description
        },
        {
          '@type': 'CollectionPage',
          name: title,
          url: canonical,
          inLanguage: 'ar',
          description,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: WIKI_PORTALS.length,
            itemListElement: WIKI_PORTALS.map((portal, idx) => ({
              '@type': 'ListItem',
              position: idx + 1,
              name: `بوابة ${portal.shortLabel}`,
              url: getAbsoluteUrl(getPortalPath(portal.id))
            }))
          }
        }
      ]
    });
    return;
  }

  if (descriptor.kind === 'article') {
    const { article } = descriptor;
    const articleType = inferArticleType(article);
    const title = `${article.name} — ${siteName}`;
    const plainSummary = stripWikitext(article.summary);
    const description = truncateMeta(
      `${article.subtitle ? `${article.subtitle}. ` : ''}${plainSummary}`
    );
    const canonical = getAbsoluteUrl(getArticlePath(article.id, 'read'));
    const portalUrl = getAbsoluteUrl(getPortalPath(article.portal));
    const ogImage =
      article.imageUrl && article.imageUrl.trim()
        ? article.imageUrl.startsWith('http')
          ? article.imageUrl
          : getAbsoluteUrl(article.imageUrl)
        : defaultImage;

    const articleSubcategories = getEffectiveSubcategories(article);
    document.title = title;
    upsertMetaTag('name', 'description', description);
    upsertMetaTag(
      'name',
      'keywords',
      [article.portal, article.field, ...article.categories, ...articleSubcategories].join('، ')
    );
    upsertCanonicalLink(canonical);
    upsertMetaTag('property', 'og:type', 'article');
    upsertMetaTag('property', 'og:site_name', siteName);
    upsertMetaTag('property', 'og:locale', 'ar_IQ');
    upsertMetaTag('property', 'og:title', title);
    upsertMetaTag('property', 'og:description', description);
    upsertMetaTag('property', 'og:url', canonical);
    upsertMetaTag('property', 'og:image', ogImage);
    upsertMetaTag('property', 'article:section', article.portal);
    if (article.updatedAt) {
      upsertMetaTag('property', 'article:modified_time', article.updatedAt);
    }
    upsertMetaTag('name', 'twitter:card', 'summary_large_image');
    upsertMetaTag('name', 'twitter:title', title);
    upsertMetaTag('name', 'twitter:description', description);
    upsertMetaTag('name', 'twitter:image', ogImage);

    const articleSchema: Record<string, unknown> = {
      '@type': 'Article',
      headline: article.name,
      alternativeHeadline: article.subtitle || undefined,
      description,
      inLanguage: 'ar',
      url: canonical,
      mainEntityOfPage: canonical,
      image: ogImage,
      articleSection: article.portal,
      keywords: [...article.categories, ...articleSubcategories].join(', '),
      dateModified: article.updatedAt || undefined,
      publisher: {
        '@type': 'Organization',
        name: siteName,
        url: getAbsoluteUrl(getHomePath())
      }
    };

    if (articleType === 'person') {
      const lifespan = formatPersonLifespan(article);
      articleSchema.about = {
        '@type': 'Person',
        name: article.name,
        description: article.subtitle || lifespan || undefined,
        birthDate: article.birthDate || undefined,
        deathDate: article.deathDate || undefined,
        birthPlace: article.birthplace
          ? { '@type': 'Place', name: article.birthplace }
          : undefined,
        knowsAbout: article.field || undefined
      };
    } else if (articleType === 'place') {
      const coords = parseCoordinates(article.coordinates);
      const locSummary = getPlaceLocationSummary(article);
      articleSchema.about = {
        '@type': 'Place',
        name: article.name,
        description: article.subtitle || locSummary || undefined,
        address: article.administrativeRegion || locSummary || undefined,
        ...(coords
          ? {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: coords.latitude,
                longitude: coords.longitude
              }
            }
          : {})
      };
    }

    const portalMeta = WIKI_PORTALS.find((p) => p.id === article.portal);
    const breadcrumbSchema = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: siteName,
          item: getAbsoluteUrl(getHomePath())
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: `بوابة ${portalMeta?.shortLabel ?? article.portal}`,
          item: portalUrl
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: article.name,
          item: canonical
        }
      ]
    };

    upsertJsonLd({
      '@context': 'https://schema.org',
      '@graph': [articleSchema, breadcrumbSchema]
    });
    return;
  }

  // Directory / Portal / Category / Subcategory
  const { portal, category, subcategory = 'الكل', filteredArticles } = descriptor;
  const portalMeta = portal !== 'الكل' ? WIKI_PORTALS.find((p) => p.id === portal) : undefined;
  const hasCategory = category && category !== 'الكل';
  const hasSubcategory = subcategory && subcategory !== 'الكل';

  let title = `دليل المقالات والبوابات — ${siteName}`;
  let description = `تصفح جميع المقالات والسير والعشائر والأماكن والفنون والأحداث التاريخية الفيلية الموثقة في ${siteName} (${filteredArticles.length} مقالة).`;
  let canonicalPath = getDirectoryPath();

  const breadcrumbItems: Array<Record<string, unknown>> = [
    {
      '@type': 'ListItem',
      position: 1,
      name: siteName,
      item: getAbsoluteUrl(getHomePath())
    }
  ];

  if (hasSubcategory) {
    canonicalPath = getSubcategoryPath(subcategory, portal, hasCategory ? category : 'الكل');
    if (portalMeta && hasCategory) {
      title = `التصنيف الفرعي: ${subcategory} (${category} · بوابة ${portalMeta.shortLabel}) — ${siteName}`;
      description = truncateMeta(
        `مقالات التصنيف الفرعي «${subcategory}» ضمن تصنيف «${category}» في بوابة ${portalMeta.shortLabel} على ${siteName} (${filteredArticles.length} مقالة).`
      );
      breadcrumbItems.push(
        {
          '@type': 'ListItem',
          position: 2,
          name: `بوابة ${portalMeta.shortLabel}`,
          item: getAbsoluteUrl(getPortalPath(portalMeta.id))
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: `تصنيف: ${category}`,
          item: getAbsoluteUrl(getCategoryPath(category, portalMeta.id))
        },
        {
          '@type': 'ListItem',
          position: 4,
          name: `تصنيف فرعي: ${subcategory}`,
          item: getAbsoluteUrl(canonicalPath)
        }
      );
    } else if (portalMeta) {
      title = `التصنيف الفرعي: ${subcategory} في بوابة ${portalMeta.shortLabel} — ${siteName}`;
      description = truncateMeta(
        `مقالات التصنيف الفرعي «${subcategory}» ضمن بوابة ${portalMeta.shortLabel} في ${siteName} (${filteredArticles.length} مقالة).`
      );
      breadcrumbItems.push(
        {
          '@type': 'ListItem',
          position: 2,
          name: `بوابة ${portalMeta.shortLabel}`,
          item: getAbsoluteUrl(getPortalPath(portalMeta.id))
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: `تصنيف فرعي: ${subcategory}`,
          item: getAbsoluteUrl(canonicalPath)
        }
      );
    } else if (hasCategory) {
      title = `التصنيف الفرعي: ${subcategory} (${category}) — ${siteName}`;
      description = truncateMeta(
        `مقالات التصنيف الفرعي «${subcategory}» ضمن تصنيف «${category}» في موسوعة ${siteName} (${filteredArticles.length} مقالة).`
      );
      breadcrumbItems.push(
        {
          '@type': 'ListItem',
          position: 2,
          name: `تصنيف: ${category}`,
          item: getAbsoluteUrl(getCategoryPath(category))
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: `تصنيف فرعي: ${subcategory}`,
          item: getAbsoluteUrl(canonicalPath)
        }
      );
    } else {
      title = `التصنيف الفرعي: ${subcategory} — ${siteName}`;
      description = truncateMeta(
        `جميع المقالات الموثقة في التصنيف الفرعي «${subcategory}» ضمن موسوعة ${siteName} (${filteredArticles.length} مقالة).`
      );
      breadcrumbItems.push(
        {
          '@type': 'ListItem',
          position: 2,
          name: 'الفهرس والتصنيفات',
          item: getAbsoluteUrl(getDirectoryPath())
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: `تصنيف فرعي: ${subcategory}`,
          item: getAbsoluteUrl(canonicalPath)
        }
      );
    }
  } else if (portalMeta && hasCategory) {
    title = `تصنيف: ${category} في بوابة ${portalMeta.shortLabel} — ${siteName}`;
    description = truncateMeta(
      `مقالات تصنيف «${category}» ضمن بوابة ${portalMeta.shortLabel} في ${siteName} (${filteredArticles.length} مقالة موثقة).`
    );
    canonicalPath = getCategoryPath(category, portalMeta.id);
    breadcrumbItems.push(
      {
        '@type': 'ListItem',
        position: 2,
        name: `بوابة ${portalMeta.shortLabel}`,
        item: getAbsoluteUrl(getPortalPath(portalMeta.id))
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: `تصنيف: ${category}`,
        item: getAbsoluteUrl(canonicalPath)
      }
    );
  } else if (portalMeta) {
    title = `بوابة ${portalMeta.shortLabel} — ${siteName}`;
    description = truncateMeta(
      `بوابة ${portalMeta.shortLabel} في ${siteName}: ${portalMeta.description} (${filteredArticles.length} مقالة موثقة).`
    );
    canonicalPath = getPortalPath(portalMeta.id);
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: `بوابة ${portalMeta.shortLabel}`,
      item: getAbsoluteUrl(canonicalPath)
    });
  } else if (hasCategory) {
    title = `تصنيف: ${category} — ${siteName}`;
    description = truncateMeta(
      `جميع المقالات الموثقة في تصنيف «${category}» ضمن موسوعة ${siteName} (${filteredArticles.length} مقالة).`
    );
    canonicalPath = getCategoryPath(category);
    breadcrumbItems.push(
      {
        '@type': 'ListItem',
        position: 2,
        name: 'الفهرس والتصنيفات',
        item: getAbsoluteUrl(getDirectoryPath())
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: `تصنيف: ${category}`,
        item: getAbsoluteUrl(canonicalPath)
      }
    );
  } else {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: 'دليل المقالات والبوابات',
      item: getAbsoluteUrl(canonicalPath)
    });
  }

  const canonical = getAbsoluteUrl(canonicalPath);

  document.title = title;
  upsertMetaTag('name', 'description', description);
  upsertCanonicalLink(canonical);
  upsertMetaTag('property', 'og:type', 'website');
  upsertMetaTag('property', 'og:site_name', siteName);
  upsertMetaTag('property', 'og:locale', 'ar_IQ');
  upsertMetaTag('property', 'og:title', title);
  upsertMetaTag('property', 'og:description', description);
  upsertMetaTag('property', 'og:url', canonical);
  upsertMetaTag('property', 'og:image', defaultImage);
  upsertMetaTag('name', 'twitter:card', 'summary_large_image');
  upsertMetaTag('name', 'twitter:title', title);
  upsertMetaTag('name', 'twitter:description', description);
  upsertMetaTag('name', 'twitter:image', defaultImage);

  upsertJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: title,
        description,
        url: canonical,
        inLanguage: 'ar',
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: filteredArticles.length,
          itemListElement: filteredArticles.slice(0, 50).map((art, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            name: art.name,
            url: getAbsoluteUrl(getArticlePath(art.id))
          }))
        }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems
      }
    ]
  });
}
