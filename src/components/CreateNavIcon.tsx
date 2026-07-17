/** Gradient circle + up-arrow — matches YAJ create branding, scales to fill the nav button. */
const CreateNavIcon = ({ className = "w-full h-full" }: { className?: string }) => (
  <svg viewBox="0 0 80 80" fill="none" className={className} aria-hidden>
    <defs>
      <linearGradient id="jhiCreateGrad" x1="12" y1="10" x2="68" y2="70" gradientUnits="userSpaceOnUse">
        <stop stopColor="#D946EF" />
        <stop offset="0.45" stopColor="#8B5CF6" />
        <stop offset="1" stopColor="#22D3EE" />
      </linearGradient>
    </defs>
    <circle cx="40" cy="40" r="33" stroke="url(#jhiCreateGrad)" strokeWidth="5.5" />
    <path
      fill="url(#jhiCreateGrad)"
      d="M40 21 L53 40 H45.5 V56 H34.5 V40 H27 Z"
    />
  </svg>
);

export default CreateNavIcon;
