import React from 'react';
import { cn } from '@/lib/utils';

export default function BrandLogo({ className = '', heightClass = 'h-10' }) {
  return (
    <span className={cn('inline-flex items-center', className)}>
      <img
        src="/wisedisc-logo-light.png"
        alt="Wisedisc"
        className={cn('w-auto dark:hidden', heightClass)}
        loading="eager"
      />
      <img
        src="/wisedisc-logo-dark.png"
        alt="Wisedisc"
        className={cn('hidden w-auto dark:block', heightClass)}
        loading="eager"
      />
    </span>
  );
}
