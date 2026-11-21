import React from 'react';
import { shouldHandleClientNavigation } from '../utils/routes';

interface CitationTextProps {
  text: string;
  onCitationClick?: (refId: number) => void;
  existingTitles?: string[];
  onWikiLinkClick?: (targetTitle: string) => void;
  resolveWikiLinkHref?: (targetTitle: string) => string | null;
  sectionAnchorId?: string;
  onSubheadingAnchorClick?: (anchorId: string) => void;
  compact?: boolean;
}

interface UnorderedListItem {
  text: string;
  children: string[];
}

type ParsedBlock =
  | { type: 'h3'; text: string }
  | { type: 'h4'; text: string }
  | { type: 'ol'; items: string[] }
  | { type: 'ul'; items: UnorderedListItem[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'p'; text: string };

function parseWikitableLines(lines: string[]): { headers: string[]; rows: string[][] } {
  const headers: string[] = [];
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let hasCapturedHeader = false;

  const flushRow = () => {
    if (currentRow.length > 0) {
      rows.push(currentRow);
      currentRow = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('{|') || line.startsWith('|}') || line.startsWith('|+')) {
      continue;
    }
    if (line.startsWith('|-')) {
      flushRow();
      continue;
    }
    if (line.startsWith('!')) {
      const cells = line
        .slice(1)
        .split('!!')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      if (!hasCapturedHeader && rows.length === 0 && currentRow.length === 0) {
        headers.push(...cells);
        hasCapturedHeader = true;
      } else {
        currentRow.push(...cells);
      }
      continue;
    }
    if (line.startsWith('|')) {
      const cells = line
        .slice(1)
        .split('||')
        .map((c) => c.trim());
      currentRow.push(...cells);
    }
  }
  flushRow();

  return { headers, rows };
}

function parseBlocks(text: string): ParsedBlock[] {
  const lines = text.split('\n');
  const blocks: ParsedBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Wikitable block: {| ... |}
    if (trimmed.startsWith('{|')) {
      const tableLines: string[] = [line];
      i++;
      while (i < lines.length) {
        tableLines.push(lines[i]);
        if (lines[i].trim().startsWith('|}')) {
          i++;
          break;
        }
        i++;
      }
      const parsedTable = parseWikitableLines(tableLines);
      blocks.push({ type: 'table', ...parsedTable });
      continue;
    }

    // Subheadings: ==== ... ==== or === ... ===
    const h4Match = /^====\s*(.+?)\s*====$/.exec(trimmed);
    if (h4Match) {
      blocks.push({ type: 'h4', text: h4Match[1] });
      i++;
      continue;
    }

    const h3Match = /^===\s*(.+?)\s*===$/.exec(trimmed);
    if (h3Match) {
      blocks.push({ type: 'h3', text: h3Match[1] });
      i++;
      continue;
    }

    // Ordered list: # item
    if (/^\s*#\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = /^\s*#\s+(.+)$/.exec(lines[i]);
        if (!m) break;
        items.push(m[1].trim());
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Unordered list: * item / ** subitem
    if (/^\s*\*\*?\s+/.test(line)) {
      const items: UnorderedListItem[] = [];
      while (i < lines.length) {
        const subMatch = /^\s*\*\*\s+(.+)$/.exec(lines[i]);
        if (subMatch) {
          if (items.length === 0) {
            items.push({ text: '', children: [subMatch[1].trim()] });
          } else {
            items[items.length - 1].children.push(subMatch[1].trim());
          }
          i++;
          continue;
        }
        const topMatch = /^\s*\*\s+(.+)$/.exec(lines[i]);
        if (topMatch) {
          items.push({ text: topMatch[1].trim(), children: [] });
          i++;
          continue;
        }
        break;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Standard paragraph line
    blocks.push({ type: 'p', text: trimmed });
    i++;
  }

  return blocks;
}

const INLINE_TOKEN_REGEX =
  /('''[\s\S]+?'''|''[\s\S]+?''|\[\[[^\]|]+(?:\|[^\]]+)?\]\]|\[\d+\])/;

function renderInlineTokens(
  input: string,
  options: {
    onCitationClick?: (refId: number) => void;
    existingTitlesSet: Set<string>;
    onWikiLinkClick?: (targetTitle: string) => void;
    resolveWikiLinkHref?: (targetTitle: string) => string | null;
  },
  keyPrefix = 'tok'
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = input;
  let idx = 0;

  while (remaining.length > 0) {
    const match = INLINE_TOKEN_REGEX.exec(remaining);
    if (!match || match.index === undefined) {
      nodes.push(<React.Fragment key={`${keyPrefix}-${idx++}`}>{remaining}</React.Fragment>);
      break;
    }

    if (match.index > 0) {
      nodes.push(
        <React.Fragment key={`${keyPrefix}-${idx++}`}>
          {remaining.slice(0, match.index)}
        </React.Fragment>
      );
    }

    const token = match[0];
    const tokenKey = `${keyPrefix}-${idx++}`;

    if (token.startsWith("'''") && token.endsWith("'''")) {
      const inner = token.slice(3, -3);
      nodes.push(
        <strong key={tokenKey} className="font-bold text-[#202122]">
          {renderInlineTokens(inner, options, `${tokenKey}-b`)}
        </strong>
      );
    } else if (token.startsWith("''") && token.endsWith("''")) {
      const inner = token.slice(2, -2);
      nodes.push(
        <em key={tokenKey} className="italic">
          {renderInlineTokens(inner, options, `${tokenKey}-i`)}
        </em>
      );
    } else if (token.startsWith('[[') && token.endsWith(']]')) {
      const inner = token.slice(2, -2);
      const pipeIdx = inner.indexOf('|');
      const target = (pipeIdx >= 0 ? inner.slice(0, pipeIdx) : inner).trim();
      const label = (pipeIdx >= 0 ? inner.slice(pipeIdx + 1) : inner).trim();
      const hasDedicatedArticle = options.existingTitlesSet.has(target);
      const resolvedHref = options.resolveWikiLinkHref
        ? options.resolveWikiLinkHref(target)
        : null;

      if (resolvedHref) {
        nodes.push(
          <a
            key={tokenKey}
            href={resolvedHref}
            onClick={(e) => {
              if (options.onWikiLinkClick && shouldHandleClientNavigation(e)) {
                e.preventDefault();
                options.onWikiLinkClick(target);
              }
            }}
            className={`hover:underline cursor-pointer text-right inline ${
              hasDedicatedArticle
                ? 'text-[#3366cc] font-medium'
                : 'text-[#3366cc]'
            }`}
            title={
              hasDedicatedArticle
                ? `فتح مقالة: ${target}`
                : `استكشاف موضوع: ${target}`
            }
          >
            {label}
          </a>
        );
      } else if (options.onWikiLinkClick) {
        nodes.push(
          <button
            key={tokenKey}
            type="button"
            onClick={() => options.onWikiLinkClick?.(target)}
            className={`hover:underline cursor-pointer text-right inline ${
              hasDedicatedArticle
                ? 'text-[#3366cc] font-medium'
                : 'text-[#3366cc]'
            }`}
            title={
              hasDedicatedArticle
                ? `فتح مقالة: ${target}`
                : `استكشاف موضوع: ${target}`
            }
          >
            {label}
          </button>
        );
      } else {
        nodes.push(
          <span key={tokenKey} className="text-[#3366cc]">
            {label}
          </span>
        );
      }
    } else {
      const citMatch = /^\[(\d+)\]$/.exec(token);
      if (citMatch) {
        const refNum = Number(citMatch[1]);
        nodes.push(
          <sup key={tokenKey} className="mx-0.5 font-mono-tabular text-[11px] font-medium">
            <a
              href={`#ref-${refNum}`}
              onClick={(e) => {
                if (options.onCitationClick) {
                  e.preventDefault();
                  options.onCitationClick(refNum);
                }
              }}
              className="text-[#3366cc] hover:text-[#2a4b8d] hover:underline focus-visible:outline-2 focus-visible:outline-[#3366cc] rounded-xs px-0.5"
              title={`الانتقال إلى المصدر رقم ${refNum}`}
            >
              [{refNum}]
            </a>
          </sup>
        );
      } else {
        nodes.push(<React.Fragment key={tokenKey}>{token}</React.Fragment>);
      }
    }

    remaining = remaining.slice(match.index + token.length);
  }

  return nodes;
}

export function stripWikitext(text: string): string {
  return text
    .replace(/\{\|[\s\S]*?\|\}/g, ' ')
    .replace(/={2,4}\s*([^=]+?)\s*={2,4}/g, '$1')
    .replace(/'''([\s\S]+?)'''/g, '$1')
    .replace(/''([\s\S]+?)''/g, '$1')
    .replace(/\[\[([^\]|]+?)\|([^\]]+?)\]\]/g, '$2')
    .replace(/\[\[([^\]]+?)\]\]/g, '$1')
    .replace(/\[\d+\]/g, '')
    .replace(/^\s*[*#]+\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Renders multi-paragraph Wikitext and numbered citations safely in pure React JSX (zero innerHTML),
 * supporting === subheadings ===, '''bold''', ''italic'', [[wiki links]], * / ** / # lists,
 * MediaWiki {| tables |}, and interactive [n] superscript citations.
 */
export function CitationText({
  text,
  onCitationClick,
  existingTitles = [],
  onWikiLinkClick,
  resolveWikiLinkHref,
  sectionAnchorId,
  onSubheadingAnchorClick,
  compact = false
}: CitationTextProps) {
  const existingTitlesSet = new Set(existingTitles);
  const inlineOptions = {
    onCitationClick,
    existingTitlesSet,
    onWikiLinkClick,
    resolveWikiLinkHref
  };

  if (compact) {
    return (
      <span>
        {renderInlineTokens(text, inlineOptions, 'cmp')}
      </span>
    );
  }

  const blocks = parseBlocks(text);
  let subheadingCounter = 0;

  return (
    <div className="encyclopedia-prose space-y-3.5 text-[15.5px]">
      {blocks.map((block, bIdx) => {
        if (block.type === 'h3') {
          subheadingCounter += 1;
          const subAnchorId = sectionAnchorId
            ? `${sectionAnchorId}-sub-${subheadingCounter}`
            : undefined;
          return (
            <h3
              key={bIdx}
              id={subAnchorId}
              className="group scroll-mt-24 wiki-title text-[18px] sm:text-[19.5px] leading-[1.4] font-bold text-[#202122] pt-2 pb-1 border-b border-[#eaecf0] flex items-baseline gap-2"
            >
              <span>{renderInlineTokens(block.text, inlineOptions, `h3-${bIdx}`)}</span>
              {subAnchorId && (
                <a
                  href={`#${subAnchorId}`}
                  onClick={(e) => {
                    if (onSubheadingAnchorClick && shouldHandleClientNavigation(e)) {
                      e.preventDefault();
                      onSubheadingAnchorClick(subAnchorId);
                    }
                  }}
                  aria-label="الانتقال إلى هذا العنوان الفرعي ونسخ رابطه"
                  title="رابط مباشر لهذا العنوان الفرعي"
                  className="text-xs font-mono-tabular font-normal text-[#a2a9b1] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[#3366cc] transition-opacity select-none"
                >
                  #
                </a>
              )}
            </h3>
          );
        }

        if (block.type === 'h4') {
          subheadingCounter += 1;
          const subAnchorId = sectionAnchorId
            ? `${sectionAnchorId}-sub-${subheadingCounter}`
            : undefined;
          return (
            <h4
              key={bIdx}
              id={subAnchorId}
              className="group scroll-mt-24 wiki-title text-[16px] leading-[1.4] font-bold text-[#202122] pt-1 flex items-baseline gap-2"
            >
              <span>{renderInlineTokens(block.text, inlineOptions, `h4-${bIdx}`)}</span>
              {subAnchorId && (
                <a
                  href={`#${subAnchorId}`}
                  onClick={(e) => {
                    if (onSubheadingAnchorClick && shouldHandleClientNavigation(e)) {
                      e.preventDefault();
                      onSubheadingAnchorClick(subAnchorId);
                    }
                  }}
                  aria-label="الانتقال إلى هذا العنوان الفرعي"
                  title="رابط مباشر لهذا العنوان الفرعي"
                  className="text-xs font-mono-tabular font-normal text-[#a2a9b1] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[#3366cc] transition-opacity select-none"
                >
                  #
                </a>
              )}
            </h4>
          );
        }

        if (block.type === 'ol') {
          return (
            <ol
              key={bIdx}
              className="list-decimal list-inside space-y-2 pr-1 leading-[1.82] text-[#202122]"
            >
              {block.items.map((item, iIdx) => (
                <li key={iIdx}>
                  {renderInlineTokens(item, inlineOptions, `ol-${bIdx}-${iIdx}`)}
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === 'ul') {
          return (
            <ul
              key={bIdx}
              className="list-disc list-inside space-y-1.5 pr-1 leading-[1.82] text-[#202122]"
            >
              {block.items.map((item, iIdx) => (
                <li key={iIdx}>
                  {item.text &&
                    renderInlineTokens(item.text, inlineOptions, `ul-${bIdx}-${iIdx}`)}
                  {item.children.length > 0 && (
                    <ul className="list-[circle] list-inside space-y-1 pr-6 mt-1.5 text-[15px]">
                      {item.children.map((sub, sIdx) => (
                        <li key={sIdx}>
                          {renderInlineTokens(
                            sub,
                            inlineOptions,
                            `ul-${bIdx}-${iIdx}-sub-${sIdx}`
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'table') {
          return (
            <div key={bIdx} className="overflow-x-auto my-3">
              <table className="w-full border-collapse border border-[#a2a9b1] text-[13.5px] bg-white">
                {block.headers.length > 0 && (
                  <thead>
                    <tr>
                      {block.headers.map((header, hIdx) => (
                        <th
                          key={hIdx}
                          className="bg-[#eaecf0] font-bold text-[#202122] border border-[#a2a9b1] px-3 py-2 text-right"
                        >
                          {renderInlineTokens(header, inlineOptions, `th-${bIdx}-${hIdx}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {block.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-[#f8f9fa]">
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className="border border-[#a2a9b1] px-3 py-2 align-top leading-[1.65] text-[#202122]"
                        >
                          {renderInlineTokens(cell, inlineOptions, `td-${bIdx}-${rIdx}-${cIdx}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <p key={bIdx} className="leading-[1.82] text-[#202122]">
            {renderInlineTokens(block.text, inlineOptions, `p-${bIdx}`)}
          </p>
        );
      })}
    </div>
  );
}
