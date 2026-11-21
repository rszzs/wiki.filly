import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AccentTone } from '../types/encyclopedia';
import { getImageLoadCandidates } from '../utils/storage';

export type ImageLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface SmartExternalImageProps {
  imageUrl?: string;
  alt: string;
  className?: string;
  onStatusChange?: (status: ImageLoadStatus) => void;
  fallback?: React.ReactNode;
}

export function SmartExternalImage({
  imageUrl,
  alt,
  className = '',
  onStatusChange,
  fallback = null
}: SmartExternalImageProps) {
  const candidates = useMemo(() => getImageLoadCandidates(imageUrl), [imageUrl]);
  const candidatesKey = useMemo(
    () => candidates.map((c) => `${c.referrerPolicy}:${c.src}`).join('|'),
    [candidates]
  );

  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const [attemptIndex, setAttemptIndex] = useState(0);
  const [status, setStatus] = useState<ImageLoadStatus>(() =>
    candidates.length > 0 ? 'loading' : 'idle'
  );

  useEffect(() => {
    setAttemptIndex(0);
    const nextStatus: ImageLoadStatus = candidates.length > 0 ? 'loading' : 'idle';
    setStatus(nextStatus);
    onStatusChangeRef.current?.(nextStatus);
  }, [candidatesKey, candidates.length]);

  const activeCandidate = candidates[attemptIndex];

  if (!activeCandidate || status === 'error') {
    return <>{fallback}</>;
  }

  return (
    <img
      key={`${candidatesKey}-${attemptIndex}`}
      src={activeCandidate.src}
      alt={alt}
      referrerPolicy={activeCandidate.referrerPolicy}
      loading="lazy"
      decoding="async"
      onLoad={() => {
        setStatus('loaded');
        onStatusChangeRef.current?.('loaded');
      }}
      onError={() => {
        if (attemptIndex + 1 < candidates.length) {
          setAttemptIndex((prev) => prev + 1);
        } else {
          setStatus('error');
          onStatusChangeRef.current?.('error');
        }
      }}
      className={className}
    />
  );
}

interface PortraitMedallionProps {
  articleId: string;
  initials: string;
  name: string;
  tone: AccentTone;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  onStatusChange?: (status: ImageLoadStatus) => void;
}

const TONE_PALETTES: Record<AccentTone, { start: string; end: string; ring: string; ink: string }> = {
  lapis: {
    start: '#3366cc',
    end: '#1e3a8a',
    ring: '#bfdbfe',
    ink: '#ffffff'
  },
  bronze: {
    start: '#854d0e',
    end: '#451a03',
    ring: '#fde68a',
    ink: '#ffffff'
  },
  forest: {
    start: '#14866d',
    end: '#064e3b',
    ring: '#a7f3d0',
    ink: '#ffffff'
  },
  terracotta: {
    start: '#9a3412',
    end: '#431407',
    ring: '#fed7aa',
    ink: '#ffffff'
  }
};

export function PortraitMedallion({
  articleId,
  initials,
  name,
  tone,
  imageUrl,
  size = 'lg',
  onStatusChange
}: PortraitMedallionProps) {
  const reactUid = useId().replace(/:/g, '');
  const safeId = `${articleId.replace(/[^a-zA-Z0-9_-]/g, '')}-${reactUid}`;
  const gradId = `portrait-grad-${safeId}`;
  const palette = TONE_PALETTES[tone] ?? TONE_PALETTES.lapis;

  if (size === 'sm' || size === 'md') {
    const dim = size === 'sm' ? 'w-10 h-10' : 'w-14 h-14';
    const smallFallback = (
      <svg
        viewBox="0 0 80 80"
        className="w-full h-full block"
        role="img"
        aria-label={`شعار توثيقي للشخصية: ${name}`}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.start} />
            <stop offset="100%" stopColor={palette.end} />
          </linearGradient>
        </defs>
        <rect width="80" height="80" fill={`url(#${gradId})`} />
        <circle
          cx="40"
          cy="40"
          r="30"
          fill="none"
          stroke={palette.ring}
          strokeOpacity="0.4"
          strokeWidth="1.2"
        />
        <text
          x="40"
          y="47"
          textAnchor="middle"
          fill={palette.ink}
          className="font-editorial font-bold"
          fontSize={size === 'sm' ? '22' : '24'}
        >
          {initials}
        </text>
      </svg>
    );

    return (
      <div
        className={`${dim} shrink-0 rounded border border-[#a2a9b1] bg-[#f8f9fa] overflow-hidden flex items-center justify-center`}
      >
        <SmartExternalImage
          imageUrl={imageUrl}
          alt={`صورة ${name}`}
          onStatusChange={onStatusChange}
          className="w-full h-full object-cover block"
          fallback={smallFallback}
        />
      </div>
    );
  }

  const largeFallback = (
    <svg
      viewBox="0 0 200 220"
      className="w-full h-full block"
      role="img"
      aria-label={`لوحة توثيقية للشخصية: ${name}`}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={palette.start} />
          <stop offset="100%" stopColor={palette.end} />
        </linearGradient>
      </defs>
      <rect width="200" height="220" fill={`url(#${gradId})`} />
      <circle cx="100" cy="82" r="38" fill="rgba(255,255,255,0.18)" />
      <path d="M40 205 C40 155, 160 155, 160 205" fill="rgba(255,255,255,0.18)" />
      <text
        x="100"
        y="94"
        textAnchor="middle"
        fill={palette.ink}
        className="font-editorial font-bold"
        fontSize="34"
      >
        {initials}
      </text>
      <text
        x="100"
        y="185"
        textAnchor="middle"
        fill="rgba(255,255,255,0.88)"
        className="font-ui"
        fontSize="11"
      >
        أرشيف الموسوعة
      </text>
    </svg>
  );

  return (
    <div className="w-44 h-48 mx-auto bg-[#f8f9fa] border border-[#eaecf0] rounded flex items-center justify-center overflow-hidden">
      <SmartExternalImage
        imageUrl={imageUrl}
        alt={`صورة ${name}`}
        onStatusChange={onStatusChange}
        className="w-full h-full object-cover block"
        fallback={largeFallback}
      />
    </div>
  );
}
