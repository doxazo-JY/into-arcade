"use client";

import { useState, useTransition } from "react";
import { manualAdjustScores } from "./undoActions";

export default function ManualAdjustForm({
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
  const [mode, setMode] = useState<"delta" | "set">("delta");
  const [value1, setValue1] = useState("");
  const [value2, setValue2] = useState("");
  const [memo, setMemo] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 빈 칸은 "이 팀은 안 건드림"이라는 뜻이라, 값을 입력한 팀만 골라
  // adjustments 배열로 만든다.
  const adjustments = [
    { teamNo: 1 as const, name: team1Name, raw: value1 },
    { teamNo: 2 as const, name: team2Name, raw: value2 },
  ]
    .filter((a) => a.raw !== "" && a.raw !== "-")
    .map((a) => ({ ...a, value: Number(a.raw) }));

  const isValid = adjustments.length > 0 && adjustments.every((a) => Number.isInteger(a.value));

  function submit() {
    if (!isValid) return;
    setError(null);
    startTransition(async () => {
      try {
        await manualAdjustScores(
          roomCode,
          adminToken,
          mode,
          adjustments.map((a) => ({ teamNo: a.teamNo, value: a.value })),
          memo || undefined
        );
        setValue1("");
        setValue2("");
        setMemo("");
        setConfirming(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "점수 수정에 실패했습니다");
        setConfirming(false);
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-4 border-[3px] border-ink bg-paper-2 p-5">
        <p className="font-black">이 점수 수정을 적용하시겠습니까?</p>
        {adjustments.map((a) => (
          <p key={a.teamNo} className="font-semibold">
            {a.name}:{" "}
            {mode === "delta"
              ? (a.value >= 0 ? "+" : "") + a.value.toLocaleString() + "P 조정"
              : a.value.toLocaleString() + "P로 변경"}
          </p>
        ))}
        {memo && <p className="text-sm font-semibold text-ink-faint">메모: {memo}</p>}
        {error && <p className="text-sm font-bold text-lose-ink">{error}</p>}
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
            className="flex-1 border-2 border-ink bg-ink py-3 font-black text-paper-2 disabled:opacity-50"
          >
            적용
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-[3px] border-ink bg-paper-2 p-4">
      <p className="font-black">점수 직접 수정</p>
      <div className="flex gap-2">
        <button
          onClick={() => setMode("delta")}
          className={
            "flex-1 border-2 border-ink py-2 text-sm font-bold " +
            (mode === "delta" ? "bg-ink text-paper-2" : "bg-paper-2")
          }
        >
          +/- 만큼 조정
        </button>
        <button
          onClick={() => setMode("set")}
          className={
            "flex-1 border-2 border-ink py-2 text-sm font-bold " +
            (mode === "set" ? "bg-ink text-paper-2" : "bg-paper-2")
          }
        >
          특정 값으로 변경
        </button>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold">{team1Name}</span>
        <input
          value={value1}
          onChange={(e) => setValue1(e.target.value.replace(/(?!^-)[^0-9]/g, ""))}
          inputMode="numeric"
          placeholder={mode === "delta" ? "예: 100 또는 -100 (안 건드리려면 비워둠)" : "예: -500"}
          className="border-2 border-ink px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold">{team2Name}</span>
        <input
          value={value2}
          onChange={(e) => setValue2(e.target.value.replace(/(?!^-)[^0-9]/g, ""))}
          inputMode="numeric"
          placeholder={mode === "delta" ? "예: 100 또는 -100 (안 건드리려면 비워둠)" : "예: -500"}
          className="border-2 border-ink px-3 py-2"
        />
      </label>
      <input
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="메모 (선택)"
        className="border-2 border-ink px-3 py-2 text-sm"
      />
      {error && <p className="text-sm font-bold text-lose-ink">{error}</p>}
      <button
        disabled={!isValid || isPending}
        onClick={() => setConfirming(true)}
        className="border-2 border-ink bg-ink py-3 font-black text-paper-2 disabled:opacity-40"
      >
        적용
      </button>
    </div>
  );
}
