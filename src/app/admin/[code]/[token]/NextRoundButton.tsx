"use client";

import { useTransition } from "react";
import { nextRound } from "./actions";

export default function NextRoundButton({
  roomCode,
  adminToken,
}: {
  roomCode: string;
  adminToken: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => nextRound(roomCode, adminToken))}
      className="border-2 border-ink bg-ink px-6 py-3 font-black text-paper-2 disabled:opacity-50"
    >
      다음 라운드 ▶
    </button>
  );
}
