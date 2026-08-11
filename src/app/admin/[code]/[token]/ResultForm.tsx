"use client";

import { useState, useTransition } from "react";
import { applyRoundResult } from "./actions";

export default function ResultForm({
  roomCode,
  adminToken,
  team1Name,
  team2Name,
  team1FinalBet,
  team2FinalBet,
  multiplier,
}: {
  roomCode: string;
  adminToken: string;
  team1Name: string;
  team2Name: string;
  team1FinalBet: number;
  team2FinalBet: number;
  multiplier: number;
}) {
  const [winner, setWinner] = useState<1 | 2 | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function delta(isWinner: boolean, finalBet: number) {
    // 배수는 승패 양쪽에 동일하게 적용된다.
    const magnitude = Math.trunc(finalBet * multiplier);
    return isWinner ? magnitude : -magnitude;
  }

  function submit() {
    if (!winner) return;
    setError(null);
    startTransition(async () => {
      try {
        await applyRoundResult(roomCode, adminToken, winner);
      } catch (e) {
        setError(e instanceof Error ? e.message : "결과 적용에 실패했습니다");
        setConfirming(false);
      }
    });
  }

  if (confirming && winner) {
    const d1 = delta(winner === 1, team1FinalBet);
    const d2 = delta(winner === 2, team2FinalBet);
    return (
      <div className="flex flex-col gap-4 border-[3px] border-ink bg-paper-2 p-5">
        <p className="font-black">이 결과를 적용하시겠습니까?</p>
        <p className="font-semibold">
          {team1Name}: {winner === 1 ? "승리" : "패배"} /{" "}
          <span className={"font-black " + (d1 >= 0 ? "text-win-ink" : "text-lose-ink")}>
            {d1 >= 0 ? "+" : ""}
            {d1.toLocaleString()}P
          </span>
        </p>
        <p className="font-semibold">
          {team2Name}: {winner === 2 ? "승리" : "패배"} /{" "}
          <span className={"font-black " + (d2 >= 0 ? "text-win-ink" : "text-lose-ink")}>
            {d2 >= 0 ? "+" : ""}
            {d2.toLocaleString()}P
          </span>
        </p>
        <div className="flex gap-3">
          <button
            disabled={isPending}
            onClick={() => setConfirming(false)}
            className="flex-1 border-2 border-ink bg-paper-2 py-3 font-black"
          >
            취소
          </button>
          <button
            disabled={isPending}
            onClick={submit}
            className="flex-1 border-2 border-ink bg-win py-3 font-black text-ink disabled:opacity-50"
          >
            결과 적용
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 border-[3px] border-ink bg-paper-2 p-5">
      <p className="font-black">어느 팀이 승리했나요?</p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setWinner(1)}
          className={
            "border-2 border-ink py-4 font-black " +
            (winner === 1 ? "bg-team-red text-white" : "bg-paper-2")
          }
        >
          {team1Name} 승리
        </button>
        <button
          onClick={() => setWinner(2)}
          className={
            "border-2 border-ink py-4 font-black " +
            (winner === 2 ? "bg-team-blue text-white" : "bg-paper-2")
          }
        >
          {team2Name} 승리
        </button>
      </div>
      {error && <p className="text-sm font-bold text-lose-ink">{error}</p>}
      <button
        disabled={!winner}
        onClick={() => setConfirming(true)}
        className="border-2 border-ink bg-win py-3 font-black text-ink disabled:opacity-40"
      >
        결과 적용
      </button>
    </div>
  );
}
