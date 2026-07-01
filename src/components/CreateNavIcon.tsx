import jhiHiTrim from "@/assets/jhi-hi-trim.png";

/** J-Hi create branding — trimmed "Hi" mark with upload circle. */
const CreateNavIcon = ({ className = "w-full h-full" }: { className?: string }) => (
  <img
    src={jhiHiTrim}
    alt=""
    aria-hidden
    draggable={false}
    className={`object-contain pointer-events-none select-none ${className}`}
  />
);

export default CreateNavIcon;
