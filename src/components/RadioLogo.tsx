const RadioLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Head */}
    <circle cx="32" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" fill="none" />

    {/* Shoulders */}
    <path d="M23 21c-6 2-12 5-14 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M41 21c6 2 12 5 14 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />

    {/* X-ray panel */}
    <rect x="8" y="28" width="48" height="32" rx="3" stroke="currentColor" strokeWidth="2.5" fill="none" />

    {/* Spine */}
    <line x1="32" y1="33" x2="32" y2="55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

    {/* Ribs left */}
    <path d="M32 36c-4 0-9 2-13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M32 41c-4 0-9 2-13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M32 46c-3 0-8 2-11 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />

    {/* Ribs right */}
    <path d="M32 36c4 0 9 2 13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M32 41c4 0 9 2 13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M32 46c3 0 8 2 11 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />

    {/* Pelvis */}
    <path d="M29 53c-1 1-2 2-1 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <path d="M35 53c1 1 2 2 1 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
  </svg>
);

export default RadioLogo;
