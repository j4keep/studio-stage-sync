import { describe, expect, it } from "vitest";
import { buildBattleArenaRecord, type BattleWinRow } from "./battle-records";

const base = (partial: Partial<BattleWinRow> & Pick<BattleWinRow, "id" | "winner_id" | "declared_at">): BattleWinRow => ({
  battle_title: "Test Battle",
  winner_votes: 10,
  loser_votes: 4,
  media_type: "live",
  loser_id: null,
  ...partial,
});

describe("buildBattleArenaRecord", () => {
  it("tracks wins, losses, current streak, and best streak", () => {
    const me = "user-a";
    const rows: BattleWinRow[] = [
      base({ id: "1", winner_id: me, loser_id: "b", declared_at: "2026-08-03T12:00:00Z" }),
      base({ id: "2", winner_id: me, loser_id: "c", declared_at: "2026-08-02T12:00:00Z" }),
      base({ id: "3", winner_id: "d", loser_id: me, declared_at: "2026-08-01T12:00:00Z" }),
      base({ id: "4", winner_id: me, loser_id: "e", declared_at: "2026-07-30T12:00:00Z" }),
      base({ id: "5", winner_id: me, loser_id: "f", declared_at: "2026-07-29T12:00:00Z" }),
      base({ id: "6", winner_id: me, loser_id: "g", declared_at: "2026-07-28T12:00:00Z" }),
    ];

    const record = buildBattleArenaRecord(me, rows);
    expect(record.wins).toBe(5);
    expect(record.losses).toBe(1);
    expect(record.fights).toBe(6);
    expect(record.currentStreak).toBe(2);
    expect(record.bestStreak).toBe(3);
    expect(record.winPct).toBe(83);
    expect(record.byMedia.live).toEqual({ wins: 5, losses: 1 });
  });

  it("returns zeros when the fighter has no results", () => {
    const record = buildBattleArenaRecord("nobody", []);
    expect(record.wins).toBe(0);
    expect(record.currentStreak).toBe(0);
    expect(record.bestStreak).toBe(0);
    expect(record.winPct).toBe(0);
  });
});
