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
      <div className={`flex items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#eff6ff,#dbeafe,#bfdbfe)] shadow-[0_10px_30px_-18px_rgba(29,78,216,0.45)] ring-1 ring-blue-300/70 ${markClassName}`.trim()}>
        <svg viewBox="0 0 64 64" className="h-[68%] w-[68%]" aria-hidden="true">
          <defs>
            <linearGradient id="denari-mark-blue" x1="16" y1="10" x2="48" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#2563eb" />
              <stop offset="0.5" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#0ea5e9" />
            </linearGradient>
          </defs>
          <path d="M18 12h11c13 0 23 9 23 20S42 52 29 52H18V12Z" fill="none" stroke="url(#denari-mark-blue)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M24 43h5V21h-5v22Zm9 0h5V26h-5v17Zm9 0h5V31h-5v12Z" fill="#1e3a8a" />
        </svg>
      </div>
      {showLabel ? (
        <div>
          <p className={`text-lg font-semibold tracking-tight text-slate-950 ${labelClassName}`.trim()}>{label}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-blue-700">Personal Financial Command Center</p>
        </div>
      ) : null}
    </div>
  );
}