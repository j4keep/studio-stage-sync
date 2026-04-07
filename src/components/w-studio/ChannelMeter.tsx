export type ChannelMeterProps = {
  levelL: number;
  levelR?: number;
  isStereo?: boolean;
  height?: number;
  barWidth?: number;
};

function clamp(v: number) {
  return Math.max(0, Math.min(1, v));
}

function MeterBar({
  level,
  height = 120,
  barWidth = 10,
}: {
  level: number;
  height?: number;
  barWidth?: number;
}) {
  const safe = clamp(level);
  const fillHeight = `${safe * 100}%`;

  return (
    <div
      style={{
        width: barWidth,
        height,
        background: "#1a1a1a",
        borderRadius: 6,
        overflow: "hidden",
        border: "1px solid #333",
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <div
        style={{
          width: "100%",
          height: fillHeight,
          background: safe > 0.9 ? "#ff3b30" : safe > 0.7 ? "#ffcc00" : "#34c759",
          transition: "height 60ms linear",
        }}
      />
    </div>
  );
}

/** Mono or stereo LED-style level meter (0–1 linear peaks). */
export default function ChannelMeter({
  levelL,
  levelR,
  isStereo = false,
  height = 120,
  barWidth = 10,
}: ChannelMeterProps) {
  if (isStereo) {
    return (
      <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
        <MeterBar level={levelL} height={height} barWidth={barWidth} />
        <MeterBar level={levelR ?? 0} height={height} barWidth={barWidth} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
      <MeterBar level={levelL} height={height} barWidth={barWidth} />
    </div>
  );
}
