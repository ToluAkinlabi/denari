interface DenariMarkProps {
  className?: string;
  markClassName?: string;
  labelClassName?: string;
  showLabel?: boolean;
  label?: string;
}

export function DenariMark({
  className = '',
  markClassName = 'h-12 w-12',
  labelClassName = '',
  showLabel = false,
  label = 'Denari',
}: DenariMarkProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <div className={`flex items-center justify-center rounded-2xl bg-slate-950 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.9)] ring-1 ring-blue-200/40 ${markClassName}`.trim()}>
        <svg viewBox="0 0 64 64" className="h-[68%] w-[68%]" aria-hidden="true">
          <defs>
            <linearGradient id="denari-mark-gold" x1="16" y1="10" x2="48" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#fef3c7" />
              <stop offset="0.45" stopColor="#fbbf24" />
              <stop offset="1" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <path d="M18 12h11c13 0 23 9 23 20S42 52 29 52H18V12Z" fill="none" stroke="url(#denari-mark-gold)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M24 43h5V21h-5v22Zm9 0h5V26h-5v17Zm9 0h5V31h-5v12Z" fill="#f8fafc" />
        </svg>
      </div>
      {showLabel ? (
        <div>
          <p className={`text-lg font-semibold tracking-tight text-slate-950 ${labelClassName}`.trim()}>{label}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Personal Financial Command Center</p>
        </div>
      ) : null}
    </div>
  );
}