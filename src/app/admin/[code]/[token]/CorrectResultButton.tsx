"use client";

import { useState, useTransition } from "react";
import { correctRoundResult } from "./actions";

// "다음 라운드"를 누르기 전에만 쓰는 걸 전제로 한다 — 라운드가 넘어가면
// 이 컴포넌트 자체가 화면에서 사라진다(admin/page.tsx에서 round.status
// === "RESOLVED"일 때만 렌더링).
export default function CorrectResultButton({
  roomCode,
  adminToken,
  team1Name,
  team2Name,
}: {
  roomCode: string;
  adminToken: string;
  team1Name: string;
  team2Name: string;
}) {
  const [open, setOpen] = useState(false);
  const [winner, setWinner] = useState<1 | 2 | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setWinner(null);
    setConfirming(false);
    setError(null);
  }

  function submit() {
    if (!winner) return;
    setError(null);
    startTransition(async () => {
      try {
        await correctRoundResult(roomCode, adminToken, winner);
        close();
      } catch (e) {
        setError(e instanceof Error ? e.message : "정정에 실패했습니다");
        setConfirming(false);
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-bold text-ink-faint underline">
        결과 다시 정하기
      </button>
    );
  }

  if (confirming && winner) {
    return (
      <div className="flex flex-col gap-3 border-2 border-ink bg-paper-2 p-4">
        <p className="text-sm font-black">
          {winner === 1 ? team1Name : team2Name} 승리로 정정할까요?
        </p>
        {error && <p className="text-xs font-bold text-lose-ink">{error}</p>}
        <div className="flex gap-2">
          <button
            disabled={isPending}
            onClick={() => setConfirming(false)}
            className="flex-1 border-2 border-ink bg-paper-2 py-2 text-sm font-bold"
          >
            취소
          </button>
          <button
            disabled={isPending}
            onClick={submit}
            className="flex-1 border-2 border-ink bg-event py-2 text-sm font-black text-white disabled:opacity-50"
          >
            정정 적용
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-2 border-ink bg-paper-2 p-4">
      <p className="text-sm font-black">결과 다시 정하기 — 어느 팀이 승리했나요?</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setWinner(1)}
          className={
            "border-2 border-ink py-2 text-sm font-bold " +
            (winner === 1 ? "bg-team-red text-white" : "bg-paper-2")
          }
        >
          {team1Name} 승리
        </button>
        <button
          onClick={() => setWinner(2)}
          className={
            "border-2 border-ink py-2 text-sm font-bold " +
            (winner === 2 ? "bg-team-blue text-white" : "bg-paper-2")
          }
        >
          {team2Name} 승리
        </button>
      </div>
      {error && <p className="text-xs font-bold text-lose-ink">{error}</p>}
      <div className="flex gap-2">
        <button onClick={close} className="flex-1 border-2 border-ink bg-paper-2 py-2 text-sm font-bold">
          닫기
        </button>
        <button
          disabled={!winner}
          onClick={() => setConfirming(true)}
          className="flex-1 border-2 border-ink bg-ink py-2 text-sm font-black text-paper-2 disabled:opacity-40"
        >
          다음
        </button>
      </div>
    </div>
  );
}
