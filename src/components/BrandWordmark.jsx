import React from 'react';

export default function BrandWordmark({ textClassName = '' }) {
  return (
    <>
      <svg
        className="h-10 w-10 shrink-0"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="20" cy="20" r="20" fill="#1F9C8D" />
        <path
          d="M20 10L21.9 16.1L28 18L21.9 19.9L20 26L18.1 19.9L12 18L18.1 16.1L20 10Z"
          stroke="white"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M11 21L11.9 23.9L14.8 24.8L11.9 25.7L11 28.6L10.1 25.7L7.2 24.8L10.1 23.9L11 21Z" fill="white" />
        <circle cx="26.8" cy="11.8" r="1.2" fill="white" />
        <circle cx="8.6" cy="17.2" r="1.1" fill="white" />
      </svg>
      <div className={`text-[30px] font-semibold leading-none text-[#1b2639] dark:text-slate-100 ${textClassName}`}>Wisedisc</div>
    </>
  );
}
