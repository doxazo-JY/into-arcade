"use client";

import { useEffect, useState } from "react";
import { useTransition } from "react";
import { executeSwapAll, executeBetMultiplier } from "./eventActions";

type Picked = "SWAP_ALL" | "BET_MULTIPLIER" | null;

export default function EventPanel({
  roomCode,
  adminToken,
  roundStatus,
  team1Name,
  team2Name,
  team1Points,
  team2Points,
  onBusyChange,
}: {
  roomCode: string;
  adminToken: string;
  roundStatus: string;
  team1Name: string;
  team2Name: string;
  team1Points: number;
  team2Points: number;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [picked, setPicked] = useState<Picked>(null);
  const [multiplier, setMultiplier] = useState("2");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    onBusyChange?.(picked !== null);
  }, [picked, onBusyChange]);

  function cancel() {
    setPicked(null);
    setError(null);
  }

  function confirmSwap() {
    setError(null);
    startTransition(async () => {
      try {
        await executeSwapAll(roomCode, adminToken);
        setPicked(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "이벤트 실행에 실패했습니다");
      }
    });
  }

  function confirmMultiplier() {
    const value = Number(multiplier);
    if (!value || value <= 0) {
      setError("올바른 배수를 입력해주세요");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await executeBetMultiplier(roomCode, adminToken, value);
        setPicked(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "이벤트 실행에 실패했습니다");
      }
    });
  }

  if (picked === "SWAP_ALL") {
    return (
      <div className="flex flex-col gap-4 border-[3px] border-ink bg-paper-2 p-5">
        <p className="flex items-center gap-2 font-black">
          <span className="icon-bolt text-event" /> 전체 점수 교환을 실행하시겠습니까?
        </p>
        <p className="text-sm font-semibold">
          {team1Name}: {team1Points.toLocaleString()}P → {team2Points.toLocaleString()}P
        </p>
        <p className="text-sm font-semibold">
          {team2Name}: {team2Points.toLocaleString()}P → {team1Points.toLocaleString()}P
        </p>
        <p className="text-xs font-semibold text-ink-faint">공개 방식: 전체 공개</p>
        {error && <p className="text-sm font-bold text-lose-ink">{error}</p>}
        <div className="flex gap-3">
          <button
            disabled={isPending}
            onClick={cancel}
            className="flex-1 border-2 border-ink bg-paper-2 py-3 font-black"
          >
            취소
          </button>
          <button
            disabled={isPending}
            onClick={confirmSwap}
            className="flex-1 border-2 border-ink bg-event py-3 font-black text-white disabled:opacity-50"
          >
            실행
          </button>
        </div>
      </div>
    );
  }

  if (picked === "BET_MULTIPLIER") {
    return (
      <div className="flex flex-col gap-4 border-[3px] border-ink bg-paper-2 p-5">
        <p className="flex items-center gap-2 font-black">
          <span className="icon-bolt text-event" /> 배팅 배수 이벤트
        </p>
        <input
          value={multiplier}
          onChange={(e) => setMultiplier(e.target.value)}
          inputMode="decimal"
          placeholder="배수 (예: 2)"
          className="border-2 border-ink bg-paper-2 px-3 py-2 text-center text-lg font-bold"
        />
        <p className="text-sm font-semibold text-ink-soft">
          이번 라운드: 이긴 팀은 배팅한 금액의 {multiplier || "?"}배를 얻고, 진 팀은 배팅한 금액의{" "}
          {multiplier || "?"}배를 잃습니다.
        </p>
        <p className="text-xs font-semibold text-ink-faint">공개 방식: 전체 공개</p>
        {error && <p className="text-sm font-bold text-lose-ink">{error}</p>}
        <div className="flex gap-3">
          <button
            disabled={isPending}
            onClick={cancel}
            className="flex-1 border-2 border-ink bg-paper-2 py-3 font-black"
          >
            취소
          </button>
          <button
            disabled={isPending}
            onClick={confirmMultiplier}
            className="flex-1 border-2 border-ink bg-event py-3 font-black text-white disabled:opacity-50"
          >
            실행
          </button>
        </div>
      </div>
    );
  }

  // 두 이벤트 모두 라운드 시작 전(WAITING)에만 실행할 수 있다. 상태에 따라
  // 어떤 버튼이 보이고 안 보이는지 헷갈린다는 피드백으로 규칙을 통일함.
  if (roundStatus !== "WAITING") return null;

  return (
    <div className="mx-auto flex w-full max-w-sm gap-3">
      <button
        onClick={() => setPicked("SWAP_ALL")}
        className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap border-2 border-ink bg-paper-2 px-4 py-3 font-black text-event-ink"
      >
        <span className="icon-bolt" /> 전체 점수 교환
      </button>
      <button
        onClick={() => setPicked("BET_MULTIPLIER")}
        className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap border-2 border-ink bg-paper-2 px-4 py-3 font-black text-event-ink"
      >
        <span className="icon-bolt" /> 배팅 배수
      </button>
    </div>
  );
}
