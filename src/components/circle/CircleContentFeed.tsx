import { useCallback, useEffect, useState } from "react";
import { listCircleContents, type CircleContent, type CircleContentKind } from "@/lib/circle-content";
import CircleContentCard from "@/components/circle/CircleContentCard";

type Props = {
  circleId: string;
  userId?: string;
  canInteract: boolean;
  kind?: CircleContentKind;
  refreshKey?: number;
  emptyLabel?: string;
};

export default function CircleContentFeed({
  circleId,
  userId,
  canInteract,
  kind,
  refreshKey = 0,
  emptyLabel = "Nothing here yet.",
}: Props) {
  const [items, setItems] = useState<CircleContent[] | null>(null);

  const load = useCallback(() => {
    void listCircleContents(circleId, { kind, userId })
      .then(setItems)
      .catch(() => setItems([]));
  }, [circleId, kind, userId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (items === null) {
    return <p className="px-4 py-10 text-center text-[12px] text-[#8A7460]">Loading…</p>;
  }

  if (!items.length) {
    return <p className="px-4 py-12 text-center text-[13px] text-[#8A7460]">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-4 px-4 py-4">
      {items.map((item) => (
        <CircleContentCard
          key={item.id}
          item={item}
          userId={userId}
          canInteract={canInteract}
          onChanged={load}
        />
      ))}
    </div>
  );
}
