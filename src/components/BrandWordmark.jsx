import React from 'react';

export default function BrandWordmark({ textClassName = '' }) {
  return (
    <div className="inline-flex items-center gap-3 text-[#132f38] dark:text-[#dce5e7]">
      <svg
        className="h-10 w-11 shrink-0"
        viewBox="0 0 88 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M44 8C35 4 25 8 17 10C11 11 8 20 13 27C6 34 4 44 4 54C4 69 16 76 30 76C36 76 40 80 44 80C48 80 52 76 58 76C72 76 84 69 84 54C84 44 82 34 75 27C80 20 77 11 71 10C63 8 53 4 44 8Z"
          fill="currentColor"
        />
        <circle cx="28" cy="45" r="12" className="fill-[#e7eff0] dark:fill-[#132f38]" />
        <circle cx="28" cy="45" r="8" fill="currentColor" />
        <circle cx="34" cy="49" r="3.1" className="fill-[#e7eff0] dark:fill-[#132f38]" />

        <circle cx="60" cy="45" r="12" className="fill-[#e7eff0] dark:fill-[#132f38]" />
        <circle cx="60" cy="45" r="8" fill="currentColor" />
        <circle cx="54" cy="49" r="3.1" className="fill-[#e7eff0] dark:fill-[#132f38]" />

        <path d="M44 40L49.5 46C49.5 53.5 48.2 58.5 44 64L38.5 46L44 40Z" className="fill-[#e7eff0] dark:fill-[#132f38]" />
      </svg>
      <div className={`text-[30px] font-black leading-none lowercase tracking-[-0.02em] ${textClassName}`}>wisedisc</div>
    </div>
  );
}
