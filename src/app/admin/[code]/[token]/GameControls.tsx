"use client";

import { useState, useTransition } from "react";
import { endGame } from "./resetActions";

export default function GameControls({
  roomCode,
  adminToken,
}: {
  roomCode: string;
  adminToken: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex w-full flex-1 flex-col items-center gap-2">
      <button
        disabled={isPending}
        onClick={() => {
          if (!confirm("게임을 종료하고 최종 순위를 표시할까요?")) return;
          setError(null);
          startTransition(async () => {
            try {
              await endGame(roomCode, adminToken);
            } catch (e) {
              setError(e instanceof Error ? e.message : "게임 종료에 실패했습니다");
            }
          });
        }}
        className="w-full border-2 border-ink bg-paper-2 px-5 py-2 text-sm font-black"
      >
        게임 종료
      </button>
      {error && <p className="text-xs font-bold text-lose-ink">{error}</p>}
    </div>
  );
}
