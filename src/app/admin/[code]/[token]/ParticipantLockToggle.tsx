"use client";

import { useState, useTransition } from "react";
import { setParticipantsLocked } from "./actions";

export default function ParticipantLockToggle({
  roomCode,
  adminToken,
  locked,
}: {
  roomCode: string;
  adminToken: string;
  locked: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      try {
        await setParticipantsLocked(roomCode, adminToken, !locked);
      } catch (e) {
        setError(e instanceof Error ? e.message : "변경에 실패했습니다");
      }
    });
  }

  return (
    <div className="flex w-full flex-1 flex-col items-center gap-1">
      <button
        disabled={isPending}
        onClick={toggle}
        className={
          "w-full border-2 border-ink px-5 py-2 text-sm font-black disabled:opacity-50 " +
          (locked ? "bg-event text-white" : "bg-paper-2 text-ink")
        }
      >
        {locked ? "🔒 참가자 잠금 해제" : "참가자 화면 잠그기"}
      </button>
      {error && <p className="text-xs font-bold text-lose-ink">{error}</p>}
    </div>
  );
}
