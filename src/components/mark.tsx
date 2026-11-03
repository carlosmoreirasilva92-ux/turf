export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M7.5 15.5c0-5.2 3.6-9 8.5-9s8.5 3.8 8.5 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M7.5 15.2v7.2M24.5 15.2v7.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="11.2" cy="22.6" r="1.15" fill="currentColor" />
      <circle cx="16" cy="22.6" r="1.15" fill="currentColor" />
      <circle cx="20.8" cy="22.6" r="1.15" fill="currentColor" />
    </svg>
  );
}
