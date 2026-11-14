import React, { useEffect, useState } from 'react';
import { Sprout, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackType?: 'parcel' | 'avatar' | 'brand';
  fallbackLabel?: string;
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  alt,
  className,
  fallbackType = 'parcel',
  fallbackLabel,
  ...rest
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    const initials = (fallbackLabel || alt || 'VC')
      .replace(/^Ing\.\s*/i, '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');

    if (fallbackType === 'avatar') {
      return (
        <div
          role="img"
          aria-label={alt || 'Avatar'}
          className={cn(
            'bg-gradient-to-br from-[#1F7A3A] to-[#14532D] text-white font-display font-extrabold flex items-center justify-center select-none shrink-0',
            className
          )}
        >
          {initials ? (
            <span className="text-xs tracking-tight">{initials}</span>
          ) : (
            <User className="w-4 h-4 opacity-90" />
          )}
        </div>
      );
    }

    return (
      <div
        role="img"
        aria-label={alt || 'Imagen de parcela'}
        className={cn(
          'bg-gradient-to-br from-[#1B4D2E] via-[#23633B] to-[#133820] text-white flex flex-col items-center justify-center p-3 select-none',
          className
        )}
      >
        <Sprout className="w-7 h-7 text-[#7BD62B] mb-1 opacity-90" />
        {alt && (
          <span className="text-[11px] font-bold text-white/85 text-center line-clamp-1">
            {alt}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || ''}
      loading="eager"
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
      {...rest}
    />
  );
};
