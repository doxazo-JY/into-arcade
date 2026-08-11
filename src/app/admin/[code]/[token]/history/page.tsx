import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { toPoints } from "@/lib/points";
import { EVENT_LABELS } from "@/lib/eventLabels";
import ManualAdjustForm from "../ManualAdjustForm";
import ResetButton from "../ResetButton";
import SceneDecoration from "@/components/SceneDecoration";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
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

  const teamNameById = new Map(room.teams.map((t) => [t.id, t.name]));

  const rounds = await prisma.round.findMany({
    where: { roomId: room.id, roundResults: { some: {} } },
    include: { roundResults: true },
    orderBy: { roundNo: "desc" },
  });

  const events = await prisma.eventLog.findMany({
    where: { roomId: room.id },
    orderBy: { executedAt: "desc" },
  });

  const manualAdjustments = await prisma.scoreTransaction.findMany({
    where: { roomId: room.id, sourceType: "MANUAL_ADJUST" },
    orderBy: { createdAt: "desc" },
  });

  const allTransactions = await prisma.scoreTransaction.findMany({
    where: { roomId: room.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <SceneDecoration />
      <div className="relative z-10 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-black">기록/점수 수동 수정</h1>
        <Link
          href={`/admin/${room.code}/${room.adminToken}`}
          className="text-sm font-bold text-team-blue-ink underline"
        >
          진행자 화면으로
        </Link>
      </header>

      {room.status === "ENDED" ? (
        <p className="text-sm font-semibold text-ink-faint">
          게임이 종료된 방은 점수를 더 이상 수정할 수 없습니다.
        </p>
      ) : (
        <ManualAdjustForm
          roomCode={room.code}
          adminToken={room.adminToken}
          team1Name={room.teams[0].name}
          team2Name={room.teams[1].name}
        />
      )}

      <section className="flex flex-col gap-3">
        <p className="font-black">라운드 결과</p>
        {rounds.length === 0 && (
          <p className="text-sm font-semibold text-ink-faint">아직 적용된 결과가 없습니다.</p>
        )}
        {rounds.map((round) => (
          <div
            key={round.id}
            className="flex items-center justify-between border-2 border-ink bg-paper-2 p-3"
          >
            <div className="text-sm">
              <p className="font-black">ROUND {round.roundNo}</p>
              {round.roundResults.map((r) => (
                <p
                  key={r.id}
                  className={
                    "font-semibold " +
                    (r.reverted ? "text-ink-faint line-through" : "text-ink-soft")
                  }
                >
                  {teamNameById.get(r.teamId)}: {r.outcome === "WIN" ? "승리" : "패배"} (
                  {toPoints(r.finalBetAmount).toLocaleString()}P)
                </p>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <p className="font-black">이벤트 기록</p>
        {events.length === 0 && (
          <p className="text-sm font-semibold text-ink-faint">아직 실행된 이벤트가 없습니다.</p>
        )}
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-center justify-between border-2 border-ink bg-paper-2 p-3"
          >
            <div className="text-sm">
              <p
                className={
                  "font-black " + (event.reverted ? "text-ink-faint line-through" : "")
                }
              >
                {EVENT_LABELS[event.eventType]}
              </p>
              <p className="text-xs font-semibold text-ink-faint">
                {event.executedAt.toLocaleString("ko-KR")}
              </p>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <p className="font-black">점수 직접 수정 기록</p>
        {manualAdjustments.length === 0 && (
          <p className="text-sm font-semibold text-ink-faint">아직 직접 수정한 내역이 없습니다.</p>
        )}
        {manualAdjustments.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center justify-between border-2 border-ink bg-paper-2 p-3"
          >
            <div className="text-sm">
              <p className="font-black">
                {teamNameById.get(tx.teamId)}: {toPoints(tx.pointsDelta) >= 0 ? "+" : ""}
                {toPoints(tx.pointsDelta).toLocaleString()}P
              </p>
              <p className="text-xs font-semibold text-ink-faint">
                {tx.createdAt.toLocaleString("ko-KR")}
              </p>
              {tx.memo && (
                <p className="text-xs font-semibold text-ink-faint">메모: {tx.memo}</p>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <p className="font-black">전체 점수 변경 기록</p>
        <div className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
          {allTransactions.map((tx) => (
            <p key={tx.id}>
              [{tx.createdAt.toLocaleString("ko-KR")}] {teamNameById.get(tx.teamId)} ·{" "}
              {tx.sourceType} {toPoints(tx.pointsDelta) >= 0 ? "+" : ""}
              {toPoints(tx.pointsDelta).toLocaleString()}P → {toPoints(tx.pointsAfter).toLocaleString()}P
            </p>
          ))}
        </div>
      </section>

      <section className="flex justify-center border-t-2 border-ink pt-6">
        <ResetButton roomCode={room.code} adminToken={room.adminToken} />
      </section>
      </div>
    </main>
  );
}
