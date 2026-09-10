/** Animated smiling apple with a book — kids intro mascot. */
export default function SmilingAppleMascot({ className = "" }: { className?: string }) {
  return (
    <div className={`relative mx-auto flex h-44 w-44 items-center justify-center ${className}`} aria-hidden>
      <style>{`
        @keyframes apple-bob {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-10px) rotate(3deg); }
        }
        @keyframes apple-blink {
          0%, 42%, 48%, 100% { transform: scaleY(1); }
          45% { transform: scaleY(0.1); }
        }
        @keyframes book-wiggle {
          0%, 100% { transform: rotate(-8deg); }
          50% { transform: rotate(8deg); }
        }
        .apple-bob { animation: apple-bob 2.4s ease-in-out infinite; }
        .apple-eye { animation: apple-blink 3.6s ease-in-out infinite; transform-origin: center; }
        .book-wiggle { animation: book-wiggle 2.8s ease-in-out infinite; transform-origin: bottom center; }
      `}</style>
      <svg viewBox="0 0 200 200" className="apple-bob h-full w-full drop-shadow-lg">
        {/* stem + leaf */}
        <path d="M98 38 C98 22 108 14 118 18" stroke="#166534" strokeWidth="6" fill="none" strokeLinecap="round" />
        <ellipse cx="128" cy="22" rx="14" ry="8" fill="#22c55e" transform="rotate(20 128 22)" />
        {/* apple body */}
        <path
          d="M100 48 C70 48 48 78 48 112 C48 148 70 172 100 172 C130 172 152 148 152 112 C152 78 130 48 100 48 Z"
          fill="#ef4444"
        />
        <path d="M100 52 C88 52 78 58 72 68 C90 62 110 62 128 68 C122 58 112 52 100 52 Z" fill="#fca5a5" opacity="0.55" />
        {/* eyes */}
        <g className="apple-eye">
          <ellipse cx="82" cy="108" rx="8" ry="10" fill="#111827" />
          <ellipse cx="118" cy="108" rx="8" ry="10" fill="#111827" />
          <circle cx="84" cy="104" r="2.5" fill="#fff" />
          <circle cx="120" cy="104" r="2.5" fill="#fff" />
        </g>
        {/* smile */}
        <path d="M78 128 Q100 146 122 128" stroke="#111827" strokeWidth="5" fill="none" strokeLinecap="round" />
        {/* rosy cheeks */}
        <circle cx="68" cy="122" r="7" fill="#fb7185" opacity="0.7" />
        <circle cx="132" cy="122" r="7" fill="#fb7185" opacity="0.7" />
        {/* book on face */}
        <g className="book-wiggle">
          <rect x="70" y="88" width="60" height="42" rx="4" fill="#fef3c7" stroke="#b45309" strokeWidth="3" />
          <line x1="100" y1="88" x2="100" y2="130" stroke="#b45309" strokeWidth="3" />
          <rect x="76" y="96" width="18" height="4" rx="1" fill="#f59e0b" />
          <rect x="76" y="104" width="14" height="3" rx="1" fill="#fdba74" />
          <rect x="106" y="96" width="18" height="4" rx="1" fill="#f59e0b" />
          <rect x="106" y="104" width="14" height="3" rx="1" fill="#fdba74" />
        </g>
      </svg>
    </div>
  );
}
