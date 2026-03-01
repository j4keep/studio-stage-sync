const JhiIcon = ({ className = "w-5 h-5", active = false }: { className?: string; active?: boolean }) => {
  const c = active ? "hsl(204,100%,50%)" : "currentColor";
  const fill = active ? "hsl(204,100%,50%,0.15)" : "none";
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Antenna */}
      <line x1="10" y1="3.2" x2="10" y2="1.2" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10" cy="0.8" r="0.8" fill={c} />
      {/* Head */}
      <circle cx="10" cy="6.8" r="3.8" stroke={c} strokeWidth="1.8" fill={fill} />
      {/* Eyes */}
      <circle cx="8.6" cy="6.2" r="0.9" fill={c} />
      <circle cx="11.4" cy="6.2" r="0.9" fill={c} />
      {/* Smile */}
      <path d="M8.6 8Q10 9.2 11.4 8" stroke={c} strokeWidth="1" strokeLinecap="round" fill="none" />
      {/* Body */}
      <rect x="7" y="11.2" width="6" height="4.5" rx="1.5" stroke={c} strokeWidth="1.8" fill={active ? "hsl(204,100%,50%,0.1)" : "none"} />
      {/* Left Arm */}
      <path d="M7 12.8L4.2 14.8" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      {/* Right Arm */}
      <path d="M13 12.8L15.8 14.8" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      {/* Left Leg */}
      <path d="M8.8 15.7L7.8 18.8" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      {/* Right Leg */}
      <path d="M11.2 15.7L12.2 18.8" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
};

export default JhiIcon;
