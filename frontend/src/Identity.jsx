import React from 'react';

const drawings = {
  person: (
    <>
      <circle cx="12" cy="7" r="3.5" />
      <path d="M4.5 20v-1.5a7.5 7.5 0 0 1 15 0V20" />
    </>
  ),
  lock: (
    <>
      <rect x="5.5" y="10" width="13" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.7" />
    </>
  ),
  eyeOff: (
    <>
      <path d="m3 3 18 18M9 5.6a10 10 0 0 1 3-.6c6.5 0 10 7 10 7a18 18 0 0 1-2.6 3.4M6 6.7C3.4 8.8 2 12 2 12s3.5 7 10 7a11 11 0 0 0 4.2-.9" />
    </>
  ),
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  external: <path d="M6 18 18 6M7 6h11v11" />,
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.7 8.7 0 1 0 20 14.5Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="3.7" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9.4a2.7 2.7 0 1 1 4.4 2.1c-1.2 1-1.8 1.2-1.8 2.7m0 2h.01" />
    </>
  ),
  hand: (
    <>
      <path d="m4 4 6 15 2.8-6.1L19 10Z" />
    </>
  ),
  check: <path d="m4.5 12 5 5 10-10" />,
  close: <path d="m5 5 14 14M19 5 5 19" />,
  shield: (
    <>
      <path d="m12 2 8 3v6c0 5-4.5 8.2-8 11-3.5-2.8-8-6-8-11V5Z" />
      <path d="m8.5 11.5 2.5 2.6 4.5-5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.5v6l4 2" />
    </>
  ),
};
export function Icon({ name, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {drawings[name]}
    </svg>
  );
}
export function ThemeSwitch({ theme, onToggleTheme }) {
  return (
    <div className="theme-switch" role="group" aria-label="Color theme">
      {['light', 'dark'].map((mode) => (
        <button
          key={mode}
          type="button"
          aria-pressed={theme === mode}
          onClick={() => theme !== mode && onToggleTheme()}
        >
          <Icon name={mode === 'light' ? 'sun' : 'moon'} size={17} />
          <span>{mode === 'light' ? 'Light' : 'Dark'}</span>
        </button>
      ))}
    </div>
  );
}
