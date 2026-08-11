import { prisma } from "@/lib/prisma";
import { toPoints } from "@/lib/points";
import { getVisibleEventForTeam } from "@/lib/events";
import { getCurrentRoom } from "@/lib/currentRoom";
import { notFound } from "next/navigation";
import BetForm from "./BetForm";
import EventPopup from "./EventPopup";
import JoinForm from "./JoinForm";
import PollRefresh from "@/components/PollRefresh";
import BackLock from "@/components/BackLock";
import RememberTeam from "@/components/RememberTeam";
import FinalRanking from "@/components/FinalRanking";
import RoundHistoryTable from "@/components/RoundHistoryTable";
import { getRoundHistory } from "@/lib/roundHistory";
import ActiveMultiplierBanner from "@/components/ActiveMultiplierBanner";
import { getActiveMultiplierEvent } from "@/lib/activeMultiplier";
import GameInProgressBadge from "@/components/GameInProgressBadge";
import SceneDecoration from "@/components/SceneDecoration";

// 실시간 게임 상태를 보여주는 페이지라 절대 캐싱하면 안 된다. 캐싱되면
// 새로고침(router.refresh)을 해도 오래된 화면이 계속 나온다.
export const dynamic = "force-dynamic";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ teamNo: string }>;
}) {
  const { teamNo: teamNoParam } = await params;
  const teamNo = teamNoParam === "1" ? 1 : teamNoParam === "2" ? 2 : null;
  if (!teamNo) {
    notFound();
  }

  const room = await getCurrentRoom();
  if (!room) {
    notFound();
  }

  const me = room.teams.find((t) => t.teamNo === teamNo);
  if (!me) {
    notFound();
  }
  const opponent = room.teams.find((t) => t.id !== me.id)!;
  const isRed = me.teamNo === 1;

  const opponentDefaultName = opponent.teamNo === 1 ? "1팀" : "2팀";
  const opponentJoined = opponent.name !== opponentDefaultName;

  const defaultName = teamNo === 1 ? "1팀" : "2팀";
  if (me.name === defaultName) {
    return (
      <JoinForm teamNo={teamNo} teamColor={isRed ? "red" : "blue"} locked={room.participantsLocked} />
    );
  }

  // 서로 의존 관계가 없는 조회는 Promise.all로 병렬 실행한다 — 순차 await로
  // 짜면 폴링(PollRefresh)마다 DB 왕복이 그대로 누적돼 화면 반영이 눈에
  // 띄게 느려진다(중계 화면은 조회가 적어 이 문제가 덜 드러났었음).
  const [round, visibleEvent] = await Promise.all([
    prisma.round.findUnique({
      where: { roomId_roundNo: { roomId: room.id, roundNo: room.currentRound } },
    }),
    getVisibleEventForTeam(room.id, me),
  ]);

  const isResolved = round?.status === "RESOLVED";

  // 상대 팀 배팅 금액·결과는 라운드가 끝난 뒤에도 이 화면에서 절대 노출하지
  // 않는다 — 상대 팀 상황을 몰라야 배팅 게임의 긴장감이 유지된다는 판단
  // (2026-08-10). 자기 팀 결과·점수는 그대로 보여준다.
  const [myBet, opponentBet, myResult, activeMultiplierEvent] = await Promise.all([
    round
      ? prisma.bet.findUnique({ where: { roundId_teamId: { roundId: round.id, teamId: me.id } } })
      : null,
    round
      ? prisma.bet.findUnique({
          where: { roundId_teamId: { roundId: round.id, teamId: opponent.id } },
        })
      : null,
    isResolved
      ? prisma.roundResult.findUnique({
          where: { roundId_teamId: { roundId: round!.id, teamId: me.id } },
        })
      : null,
    getActiveMultiplierEvent(room.id, round?.id, round?.status),
  ]);

  const maxBet =
    me.currentPoints > BigInt(0) ? toPoints(me.currentPoints) : toPoints(room.negativeBetLimit);

  function calcResultAmount(result: { outcome: string; finalBetAmount: bigint }) {
    return Math.trunc(toPoints(result.finalBetAmount) * Number(round!.multiplier));
  }

  const resultAmount = myResult ? calcResultAmount(myResult) : 0;
  const myPoints = toPoints(me.currentPoints);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <SceneDecoration />
      <PollRefresh />
      <BackLock active={room.participantsLocked} />
      <RememberTeam teamNo={teamNo} />

      <div className="relative z-10 flex flex-col gap-6">
      <header className="flex flex-col items-center gap-3">
        <span
          className={
            "inline-flex items-center gap-2 border-2 border-ink px-4 py-1.5 text-sm font-black text-white " +
            (isRed ? "bg-team-red" : "bg-team-blue")
          }
        >
          {me.name}
        </span>
        <p className="text-sm font-bold text-ink-soft">현재 보유 포인트</p>
        <p
          className={
            "text-5xl font-black tabular-nums tracking-tight " +
            (myPoints < 0 ? "text-lose-ink" : "text-ink")
          }
        >
          {myPoints.toLocaleString()}P
        </p>
      </header>

      {room.status === "ENDED" ? (
        <>
          <FinalRanking
            team1Name={room.teams.find((t) => t.teamNo === 1)!.name}
            team2Name={room.teams.find((t) => t.teamNo === 2)!.name}
            team1Points={toPoints(room.teams.find((t) => t.teamNo === 1)!.currentPoints)}
            team2Points={toPoints(room.teams.find((t) => t.teamNo === 2)!.currentPoints)}
            myTeamNo={teamNo}
          />
          <RoundHistoryTable
            team1Name={room.teams.find((t) => t.teamNo === 1)!.name}
            team2Name={room.teams.find((t) => t.teamNo === 2)!.name}
            entries={await getRoundHistory(
              room.id,
              room.teams.find((t) => t.teamNo === 1)!.id,
              room.teams.find((t) => t.teamNo === 2)!.id
            )}
          />
        </>
      ) : (
        <>
          <div className="mx-auto inline-flex items-center gap-2 border-2 border-ink bg-win px-4 py-1.5 text-xs font-black tracking-wide text-ink">
            ★ ROUND {room.currentRound}
          </div>

          <EventPopup event={visibleEvent} />

          {activeMultiplierEvent && round && (
            <ActiveMultiplierBanner multiplier={Number(round.multiplier)} />
          )}

          {round?.status === "BETTING" && !myBet?.confirmed && (
            <BetForm teamNo={teamNo} maxBet={maxBet} teamColor={isRed ? "red" : "blue"} />
          )}

          {round?.status === "BETTING" && myBet?.confirmed && !opponentBet?.confirmed && (
            <div className="flex flex-col items-center gap-3 border-[3px] border-ink bg-paper-2 p-7 text-center shadow-sticker">
              <div className="flex gap-1.5">
                <span className="wait-dot h-2.5 w-2.5 rounded-full bg-ink" />
                <span className="wait-dot h-2.5 w-2.5 rounded-full bg-ink" />
                <span className="wait-dot h-2.5 w-2.5 rounded-full bg-ink" />
              </div>
              <p className="text-lg font-black">배팅 완료!</p>
              <p className="text-sm font-semibold text-ink-soft">
                {opponent.name}의 배팅을 기다리고 있어요
              </p>
            </div>
          )}

          {round?.status === "BETTING" && myBet?.confirmed && opponentBet?.confirmed && (
            <GameInProgressBadge />
          )}

          {myResult && (
            <div className="animate-pop-in flex flex-col items-center gap-2 border-[3px] border-ink bg-paper-2 p-7 text-center shadow-sticker">
              <span
                className={
                  "border-2 border-ink px-4 py-1 text-xs font-black tracking-wide " +
                  (myResult.outcome === "WIN" ? "bg-win text-ink" : "bg-lose-tint text-lose-ink")
                }
              >
                {myResult.outcome === "WIN" ? "WIN!" : "LOSE!"}
              </span>
              <p
                className={
                  "text-3xl font-black " +
                  (myResult.outcome === "WIN" ? "text-win-ink" : "text-lose-ink")
                }
              >
                {myResult.outcome === "WIN" ? "승리!" : "패배…"}
              </p>
              <p
                className={
                  "border-2 border-ink px-4 py-1 text-xl font-black tabular-nums " +
                  (myResult.outcome === "WIN"
                    ? "bg-win-tint text-win-ink"
                    : "bg-lose-tint text-lose-ink")
                }
              >
                {myResult.outcome === "WIN" ? "+" : "-"}
                {resultAmount.toLocaleString()}P
              </p>
              <p className="mt-1 text-xs font-bold text-ink-faint">
                현재 {myPoints.toLocaleString()}P
              </p>
            </div>
          )}

          {(!round || round.status === "WAITING") && (
            <div className="flex flex-col items-center gap-2 border-2 border-dashed border-ink-faint p-6 text-center">
              <p className="font-bold text-ink-soft">
                {opponentJoined ? "라운드 시작을 기다리고 있어요" : "상대팀 입장을 기다리고 있어요"}
              </p>
              <p className="text-xs font-semibold text-ink-faint">상대 팀: {opponent.name}</p>
            </div>
          )}
        </>
      )}
      </div>
    </main>
  );
}
