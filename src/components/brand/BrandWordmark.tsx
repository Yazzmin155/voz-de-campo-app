import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BrandWordmarkProps {
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  showSubtitle?: boolean;
  className?: string;
}

export const BrandWordmark: React.FC<BrandWordmarkProps> = ({
  size = 'md',
  animated = false,
  showSubtitle = false,
  className
}) => {
  const iconDims = {
    sm: 'w-9 h-9 rounded-2xl p-1',
    md: 'w-12 h-12 rounded-2xl p-1.5',
    lg: 'w-20 h-20 rounded-3xl p-2'
  }[size];

  const titleClasses = {
    sm: 'text-lg leading-none',
    md: 'text-xl leading-none',
    lg: 'text-3xl leading-none'
  }[size];

  const Wrapper = animated ? motion.div : 'div';

  return (
    <Wrapper
      {...(animated
        ? {
            initial: { opacity: 0, scale: 0.9, y: 10 },
            animate: { opacity: 1, scale: 1, y: 0 },
            transition: { type: 'spring', stiffness: 320, damping: 22 }
          }
        : {})}
      className={cn('inline-flex items-center gap-3 select-none', className)}
    >
      <div className="relative shrink-0">
        {animated && (
          <motion.span
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1.18, opacity: [0, 0.45, 0] }}
            transition={{ duration: 1.3, ease: 'easeOut' }}
            className="absolute inset-0 rounded-3xl border-2 border-[#58A700] pointer-events-none"
          />
        )}
        <div
          className={cn(
            'bg-white border-2 border-[#DFEAD8] shadow-xs flex items-center justify-center overflow-hidden',
            iconDims
          )}
        >
          <img
            src="/brand/logo-mark.png"
            alt="Logo oficial Voz de Campo"
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      <div className="flex flex-col text-left">
        <div className={cn('font-display font-extrabold tracking-tight flex items-baseline gap-1', titleClasses)}>
          <span className="text-app-ink">Voz de</span>
          <span className="text-[#58A700] dark:text-[#7BD62B]">Campo</span>
          <span className="inline-block w-2 h-2 rounded-full bg-[#FFC800] ml-0.5 mb-0.5" />
        </div>
        {showSubtitle && (
          <span className="text-xs font-semibold text-app-muted mt-1">
            Tu copiloto de campo · Escudo Legal y Pasaporte QR
          </span>
        )}
      </div>
    </Wrapper>
  );
};
