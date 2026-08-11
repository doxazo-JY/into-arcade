import { prisma } from "@/lib/prisma";
import { toPoints } from "@/lib/points";
import { EVENT_LABELS } from "@/lib/eventLabels";
import type { Team } from "@/generated/prisma/client";

export type TeamEventView = {
  id: string;
  title: string;
  myDelta: number | null;
  myPointsBefore: number | null;
  myPointsAfter: number | null;
  // 배팅 배수처럼 실행 즉시 점수가 안 바뀌는(myDelta가 null인) 이벤트에서만
  // 쓰인다 — 몇 배가 적용됐는지 팝업에 그대로 보여주기 위함.
  multiplier: number | null;
};

// 이벤트는 항상 양 팀 대상 + 전체 공개이므로, 되돌리지 않은 가장 최근
// 이벤트를 그대로 보여주면 된다.
export async function getVisibleEventForTeam(roomId: string, me: Team): Promise<TeamEventView | null> {
  const event = await prisma.eventLog.findFirst({
    where: { roomId, reverted: false },
    orderBy: { executedAt: "desc" },
  });

  if (!event) return null;

  const [tx, round] = await Promise.all([
    prisma.scoreTransaction.findFirst({
      where: { eventLogId: event.id, teamId: me.id },
    }),
    event.eventType === "BET_MULTIPLIER" && event.roundId
      ? prisma.round.findUnique({ where: { id: event.roundId } })
      : null,
  ]);

  return {
    id: event.id,
    title: EVENT_LABELS[event.eventType],
    myDelta: tx ? toPoints(tx.pointsDelta) : null,
    myPointsBefore: tx ? toPoints(tx.pointsBefore) : null,
    myPointsAfter: tx ? toPoints(tx.pointsAfter) : null,
    multiplier: round ? Number(round.multiplier) : null,
  };
}
