export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path
        d="M10 24C5 19 5 9 10 6c4-3 8-3 12 0 5 3 5 13 0 18l-4-3c4-4 4-10 1-12-2-2-4-2-6 0-3 2-3 8 1 12l-4 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="m8 12 3 1m-2 5 3-1m12-4-3 1m2 5-3-1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
