const JhiIcon = ({ className = "w-5 h-5", active = false }: { className?: string; active?: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* Head */}
    <circle cx="12" cy="7" r="4.5" stroke={active ? "hsl(204,100%,50%)" : "currentColor"} strokeWidth="1.8" fill={active ? "hsl(204,100%,50%,0.15)" : "none"} />
    {/* Eyes */}
    <circle cx="10.5" cy="6.5" r="0.8" fill={active ? "hsl(204,100%,50%)" : "currentColor"} />
    <circle cx="13.5" cy="6.5" r="0.8" fill={active ? "hsl(204,100%,50%)" : "currentColor"} />
    {/* Smile */}
    <path d="M10.5 8.5Q12 9.5 13.5 8.5" stroke={active ? "hsl(204,100%,50%)" : "currentColor"} strokeWidth="1" strokeLinecap="round" fill="none" />
    {/* Body */}
    <rect x="9" y="12" width="6" height="5" rx="1.5" stroke={active ? "hsl(204,100%,50%)" : "currentColor"} strokeWidth="1.8" fill={active ? "hsl(204,100%,50%,0.1)" : "none"} />
    {/* Left Arm */}
    <path d="M9 13.5L6.5 15.5" stroke={active ? "hsl(204,100%,50%)" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" />
    {/* Right Arm */}
    <path d="M15 13.5L17.5 15.5" stroke={active ? "hsl(204,100%,50%)" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" />
    {/* Left Leg */}
    <path d="M10.5 17L9.5 20" stroke={active ? "hsl(204,100%,50%)" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" />
    {/* Right Leg */}
    <path d="M13.5 17L14.5 20" stroke={active ? "hsl(204,100%,50%)" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" />
    {/* Antenna */}
    <line x1="12" y1="2.5" x2="12" y2="1" stroke={active ? "hsl(204,100%,50%)" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="0.7" r="0.7" fill={active ? "hsl(204,100%,50%)" : "currentColor"} />
  </svg>
);

export default JhiIcon;
