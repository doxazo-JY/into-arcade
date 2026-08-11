import { prisma } from "@/lib/prisma";
import { toPoints } from "@/lib/points";

export type RoundHistoryTeamResult = {
  finalBet: number;
  outcome: "WIN" | "LOSE";
  delta: number;
  pointsBefore: number;
  pointsAfter: number;
};

export type SwapPointsEntry = {
  before: number;
  after: number;
};

export type ManualAdjustHistoryEntry = {
  teamNo: 1 | 2;
  delta: number;
  pointsBefore: number;
  pointsAfter: number;
  memo: string | null;
};

export type RoundHistoryEntry = {
  roundNo: number;
  team1: RoundHistoryTeamResult | null;
  team2: RoundHistoryTeamResult | null;
  multiplier: number | null;
  swapAllBefore: boolean;
  swapTeam1: SwapPointsEntry | null;
  swapTeam2: SwapPointsEntry | null;
  manualAdjustsBefore: ManualAdjustHistoryEntry[];
  manualAdjustsAfter: ManualAdjustHistoryEntry[];
};

// 게임 종료 후에는 배팅 금액을 공개해도 상관없으므로, 라운드별 배팅/결과
// 내역을 정리해서 보여준다. 이벤트·점수 직접 수정도 실제 일어난 시점
// 그대로 같이 표시한다 — 배팅 배수는 해당 라운드의 multiplier 필드가 곧
// 그 정보라 별도 조회 없이 판단 가능하고, 전체 점수 교환과 점수 직접
// 수정은 둘 다 roundId(그 조작이 일어났을 때의 "지금 라운드")로 판단한다.
export async function getRoundHistory(
  roomId: string,
  team1Id: string,
  team2Id: string
): Promise<RoundHistoryEntry[]> {
  const rounds = await prisma.round.findMany({
    where: { roomId },
    include: { roundResults: { where: { reverted: false } } },
    orderBy: { roundNo: "asc" },
  });

  const swapEvents = await prisma.eventLog.findMany({
    where: { roomId, eventType: "SWAP_ALL", reverted: false },
    select: { id: true, roundId: true },
  });
  const swapRoundIds = new Set(swapEvents.map((e) => e.roundId));

  // 포인트 "전/후" 값은 다시 계산하지 않고 원장(ScoreTransaction)에서 그대로
  // 읽는다 — 되돌리기가 있어도 각 트랜잭션 자체는 그대로 남기 때문에(보정
  // 트랜잭션을 추가로 쌓는 방식) 그 시점 기준 정답 소스로 쓸 수 있다.
  // 결과 정정(correctRoundResult)이 있으면 같은 라운드+팀에 BET_RESULT
  // 트랜잭션이 여러 건 쌓이는데, 시간순으로 봤을 때 "이 라운드 시작 전
  // 점수(가장 이른 pointsBefore) → 정정까지 다 반영된 최종 점수(가장 늦은
  // pointsAfter)"만 보여줘야 중간의 틀렸던 상태가 안 섞여 보인다.
  const [betTxs, swapTxs] = await Promise.all([
    prisma.scoreTransaction.findMany({
      where: {
        roomId,
        teamId: { in: [team1Id, team2Id] },
        sourceType: "BET_RESULT",
        roundId: { not: null },
      },
      orderBy: { createdAt: "asc" },
      select: { roundId: true, teamId: true, pointsBefore: true, pointsAfter: true },
    }),
    swapEvents.length
      ? prisma.scoreTransaction.findMany({
          where: {
            roomId,
            teamId: { in: [team1Id, team2Id] },
            sourceType: "EVENT",
            eventLogId: { in: swapEvents.map((e) => e.id) },
          },
          select: { eventLogId: true, teamId: true, pointsBefore: true, pointsAfter: true },
        })
      : Promise.resolve([]),
  ]);

  const betTxMap = new Map<string, { before: number; after: number }>();
  for (const t of betTxs) {
    const key = `${t.roundId}-${t.teamId}`;
    const existing = betTxMap.get(key);
    if (existing) {
      existing.after = toPoints(t.pointsAfter);
    } else {
      betTxMap.set(key, { before: toPoints(t.pointsBefore), after: toPoints(t.pointsAfter) });
    }
  }

  const swapPointsByEvent = new Map<string, { team1?: SwapPointsEntry; team2?: SwapPointsEntry }>();
  for (const t of swapTxs) {
    if (!t.eventLogId) continue;
    const entry = swapPointsByEvent.get(t.eventLogId) ?? {};
    const points = { before: toPoints(t.pointsBefore), after: toPoints(t.pointsAfter) };
    if (t.teamId === team1Id) entry.team1 = points;
    if (t.teamId === team2Id) entry.team2 = points;
    swapPointsByEvent.set(t.eventLogId, entry);
  }
  const swapPointsByRound = new Map<string, { team1?: SwapPointsEntry; team2?: SwapPointsEntry }>();
  for (const e of swapEvents) {
    if (!e.roundId) continue;
    const points = swapPointsByEvent.get(e.id);
    if (points) swapPointsByRound.set(e.roundId, points);
  }

  const buildTeamResult = (
    results: { teamId: string; outcome: string; finalBetAmount: bigint }[],
    teamId: string,
    multiplier: number,
    roundId: string
  ): RoundHistoryTeamResult | null => {
    const result = results.find((r) => r.teamId === teamId);
    if (!result || result.outcome === "PENDING") return null;
    const finalBet = toPoints(result.finalBetAmount);
    const outcome = result.outcome as "WIN" | "LOSE";
    const magnitude = Math.trunc(finalBet * multiplier);
    const delta = outcome === "WIN" ? magnitude : -magnitude;
    const points = betTxMap.get(`${roundId}-${teamId}`);
    return {
      finalBet,
      outcome,
      delta,
      pointsBefore: points?.before ?? 0,
      pointsAfter: points?.after ?? 0,
    };
  };

  // 점수 직접 수정은 조작 시점의 "지금 라운드"(roundId)에 묶여 저장된다
  // (manualAdjustScores 참고). 다만 "지금 라운드"는 이미 결과가 확정된
  // (RESOLVED) 라운드일 수도 있어서 — 예: 라운드 1 결과 판정 후 "다음
  // 라운드"를 누르기 전에 수정한 경우 — 무조건 그 라운드 행 앞에 끼워
  // 넣으면 실제로는 결과가 나온 "뒤"에 일어난 조작이 "전"에 일어난 것처럼
  // 보인다. 그 라운드의 결과 확정 시각(RoundResult.appliedAt)과 비교해서
  // 그 전이면 라운드 행 앞에, 후면 라운드 행 뒤에 넣는다.
  const manualAdjustTxs = await prisma.scoreTransaction.findMany({
    where: {
      roomId,
      teamId: { in: [team1Id, team2Id] },
      sourceType: "MANUAL_ADJUST",
      roundId: { not: null },
    },
    orderBy: { createdAt: "asc" },
    select: { roundId: true, teamId: true, pointsBefore: true, pointsDelta: true, pointsAfter: true, memo: true, createdAt: true },
  });
  const resolvedAtByRound = new Map(
    rounds
      .filter((r) => r.roundResults.length > 0)
      .map((r) => [r.id, r.roundResults[0].appliedAt])
  );
  const manualAdjustsBeforeByRound = new Map<string, ManualAdjustHistoryEntry[]>();
  const manualAdjustsAfterByRound = new Map<string, ManualAdjustHistoryEntry[]>();
  for (const tx of manualAdjustTxs) {
    const entry: ManualAdjustHistoryEntry = {
      teamNo: tx.teamId === team1Id ? 1 : 2,
      delta: toPoints(tx.pointsDelta),
      pointsBefore: toPoints(tx.pointsBefore),
      pointsAfter: toPoints(tx.pointsAfter),
      memo: tx.memo,
    };
    const resolvedAt = resolvedAtByRound.get(tx.roundId!);
    const map =
      resolvedAt && tx.createdAt > resolvedAt ? manualAdjustsAfterByRound : manualAdjustsBeforeByRound;
    const list = map.get(tx.roundId!) ?? [];
    list.push(entry);
    map.set(tx.roundId!, list);
  }

  return rounds
    .filter(
      (r) =>
        r.roundResults.length > 0 ||
        manualAdjustsBeforeByRound.has(r.id) ||
        manualAdjustsAfterByRound.has(r.id)
    )
    .map((r) => {
      const multiplier = Number(r.multiplier);
      const swap = swapPointsByRound.get(r.id);
      return {
        roundNo: r.roundNo,
        team1: buildTeamResult(r.roundResults, team1Id, multiplier, r.id),
        team2: buildTeamResult(r.roundResults, team2Id, multiplier, r.id),
        multiplier: multiplier !== 1 ? multiplier : null,
        swapAllBefore: swapRoundIds.has(r.id),
        swapTeam1: swap?.team1 ?? null,
        swapTeam2: swap?.team2 ?? null,
        manualAdjustsBefore: manualAdjustsBeforeByRound.get(r.id) ?? [],
        manualAdjustsAfter: manualAdjustsAfterByRound.get(r.id) ?? [],
      };
    });
}
