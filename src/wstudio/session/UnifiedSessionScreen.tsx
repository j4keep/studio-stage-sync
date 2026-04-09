import referenceImage from "@/assets/wstudio-receive-reference.png";

export default function UnifiedSessionScreen() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center overflow-hidden p-4 sm:p-6">
      <img
        src={referenceImage}
        alt="W.Studio reference interface"
        className="max-h-[calc(100vh-2rem)] max-w-full select-none object-contain sm:max-h-[calc(100vh-3rem)]"
        draggable={false}
        loading="eager"
      />
    </div>
  );
}
