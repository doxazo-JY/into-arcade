"use client";

import { useState, useTransition } from "react";
import { relinkRoom } from "./actions";

export default function RelinkRoomButton({
  code,
  adminToken,
}: {
  code: string;
  adminToken: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm(`${code} 방을 다시 "현재 진행 중"으로 연결할까요?\n참가자 링크(1팀/2팀)가 전부 이 방을 가리키게 됩니다.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await relinkRoom(code, adminToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "연결에 실패했습니다");
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={onClick}
        disabled={isPending}
        className="border-2 border-ink bg-paper-2 px-3 py-2 text-xs font-black disabled:opacity-50"
      >
        현재로 전환
      </button>
      {error && <p className="max-w-16 text-[10px] font-bold text-lose-ink">{error}</p>}
    </div>
  );
}
