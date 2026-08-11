"use client";

import { useTransition } from "react";
import { startRound } from "./actions";

export default function RoundControls({
  roomCode,
  adminToken,
  roundNo,
  roundStatus,
  disabled,
}: {
  roomCode: string;
  adminToken: string;
  roundNo: number;
  roundStatus: string;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (roundStatus !== "WAITING") return null;

  return (
    <button
      disabled={isPending || disabled}
      onClick={() => startTransition(() => startRound(roomCode, adminToken))}
      className="border-2 border-ink bg-team-blue px-6 py-3 font-black text-white shadow-sticker-sm disabled:opacity-50"
    >
      {roundNo === 1 ? "라운드 시작" : "다음 라운드"}
    </button>
  );
}
