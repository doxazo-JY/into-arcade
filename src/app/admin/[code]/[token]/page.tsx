import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { toPoints } from "@/lib/points";
import ResultForm from "./ResultForm";
import NextRoundButton from "./NextRoundButton";
import GameFlowPanel from "./GameFlowPanel";
import GameControls from "./GameControls";
import PollRefresh from "@/components/PollRefresh";
import FinalRanking from "@/components/FinalRanking";
import RoundHistoryTable from "@/components/RoundHistoryTable";
import { getRoundHistory } from "@/lib/roundHistory";
import UndoButton from "./UndoButton";
import { undoEvent } from "./undoActions";
import { getActiveMultiplierEvent } from "@/lib/activeMultiplier";
import { getCurrentRoom } from "@/lib/currentRoom";
import SceneDecoration from "@/components/SceneDecoration";
import RelinkRoomButton from "../../RelinkRoomButton";
import ParticipantLockToggle from "./ParticipantLockToggle";

// 실시간 게임 상태를 보여주는 페이지라 절대 캐싱하면 안 된다.
export const dynamic = "force-dynamic";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ code: string; token: string }>;
}) {
  const { code, token } = await params;

  const room = await prisma.room.findUnique({
    where: { code },
    include: { teams: { orderBy: { teamNo: "asc" } } },
  });

  if (!room || room.adminToken !== token) {
    notFound();
  }

  // 서로 의존 관계가 없는 조회는 Promise.all로 병렬 실행한다 — 순차 await로
  // 짜면 폴링(PollRefresh)마다 DB 왕복이 그대로 누적돼 화면 반영이 눈에
  // 띄게 느려진다(중계 화면은 조회가 적어 이 문제가 덜 드러났었음).
  const [round, currentRoom] = await Promise.all([
    prisma.round.findUnique({
      where: { roomId_roundNo: { roomId: room.id, roundNo: room.currentRound } },
    }),
    getCurrentRoom(),
  ]);

  const [bets, activeMultiplierEvent] = await Promise.all([
    round ? prisma.bet.findMany({ where: { roundId: round.id } }) : [],
    getActiveMultiplierEvent(room.id, round?.id, round?.status),
  ]);
  const betByTeam = new Map(bets.map((b) => [b.teamId, b]));

  const isCurrent = currentRoom?.id === room.id;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <SceneDecoration />
      <PollRefresh />
      <div className="relative z-10 flex flex-col gap-6">
      <header className="flex items-start justify-between gap-1">
        <div>
          <h1 className="text-2xl font-black">진행자 화면</h1>
          <p className="text-sm font-semibold text-ink-soft">
            게임방 코드 <span className="font-mono font-bold text-ink">{room.code}</span> · ROUND{" "}
            {room.currentRound}
          </p>
          {isCurrent ? (
            <p className="mt-1 text-xs font-black text-win-ink">
              ★ 지금 참가자 링크(1팀/2팀)가 연결된 방입니다
            </p>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <p className="text-xs font-bold text-ink-faint">
                더 이상 참가자 링크가 연결되어 있지 않은 과거 기록입니다
              </p>
              <RelinkRoomButton code={room.code} adminToken={room.adminToken} />
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 text-sm font-bold">
          <Link href="/admin/into" className="text-team-blue-ink underline">
            진행자 홈으로
          </Link>
          <Link
            href={`/admin/${room.code}/${room.adminToken}/history`}
            className="text-team-blue-ink underline"
          >
            기록/되돌리기
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4">
        {room.teams.map((team) => {
          const bet = betByTeam.get(team.id);
          const isRed = team.teamNo === 1;
          return (
            <div
              key={team.id}
              className={
                "flex flex-col gap-2 border-[3px] border-ink bg-paper-2 p-4 shadow-sticker-sm " +
                (isRed ? "border-t-8 border-t-team-red" : "border-t-8 border-t-team-blue")
              }
            >
              <span className="font-black">{team.name}</span>
              <p className="text-2xl font-black tabular-nums">
                {toPoints(team.currentPoints).toLocaleString()}P
              </p>
              {round && round.status !== "WAITING" && (
                <p className="text-sm font-semibold">
                  배팅:{" "}
                  {bet?.confirmed ? (
                    <span className="font-black">{toPoints(bet.amount).toLocaleString()}P</span>
                  ) : (
                    <span className="text-ink-faint">대기 중</span>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </section>

      <section className="flex justify-center">
        <ParticipantLockToggle
          roomCode={room.code}
          adminToken={room.adminToken}
          locked={room.participantsLocked}
        />
      </section>

      {activeMultiplierEvent && round && Number(round.multiplier) !== 1 && (
        <div className="flex flex-col items-center gap-2 border-2 border-ink bg-event-tint px-4 py-3 text-center">
          <p className="flex items-center gap-2 font-black text-event-ink">
            <span className="icon-bolt" /> 배팅 배수 {Number(round.multiplier)}배 적용 중
          </p>
          <UndoButton
            label="이 이벤트 취소"
            onUndo={undoEvent.bind(null, room.code, room.adminToken, activeMultiplierEvent.id)}
          />
        </div>
      )}

      {room.status === "ENDED" ? (
        <>
          <FinalRanking
            team1Name={room.teams[0].name}
            team2Name={room.teams[1].name}
            team1Points={toPoints(room.teams[0].currentPoints)}
            team2Points={toPoints(room.teams[1].currentPoints)}
          />
          <RoundHistoryTable
            team1Name={room.teams[0].name}
            team2Name={room.teams[1].name}
            entries={await getRoundHistory(room.id, room.teams[0].id, room.teams[1].id)}
          />
        </>
      ) : (
        <>
          <section className="flex justify-center">
            <GameFlowPanel
              roomCode={room.code}
              adminToken={room.adminToken}
              roundStatus={round?.status ?? "WAITING"}
              team1Name={room.teams[0].name}
              team2Name={room.teams[1].name}
              team1Points={toPoints(room.teams[0].currentPoints)}
              team2Points={toPoints(room.teams[1].currentPoints)}
            />
          </section>

          {round?.status === "BETTING" &&
            room.teams.every((t) => betByTeam.get(t.id)?.confirmed) && (
              <ResultForm
                roomCode={room.code}
                adminToken={room.adminToken}
                team1Name={room.teams[0].name}
                team2Name={room.teams[1].name}
                // 두 팀 다 확정된 상태라 이미 위에서 가져온 bets 맵의 금액이 곧
                // 최종 배팅액이다 — computeFinalBetAmount로 다시 조회할 필요 없음.
                team1FinalBet={toPoints(betByTeam.get(room.teams[0].id)!.amount)}
                team2FinalBet={toPoints(betByTeam.get(room.teams[1].id)!.amount)}
                multiplier={Number(round.multiplier)}
              />
            )}

          {round?.status === "RESOLVED" && (
            <section className="flex justify-center">
              <NextRoundButton roomCode={room.code} adminToken={room.adminToken} />
            </section>
          )}
        </>
      )}

      {room.status !== "ENDED" && (
        <section className="flex justify-center">
          <GameControls roomCode={room.code} adminToken={room.adminToken} />
        </section>
      )}
      </div>
    </main>
  );
}
