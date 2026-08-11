"use client";

import { useState } from "react";

type EventViewProps = {
  id: string;
  title: string;
  myDelta: number | null;
  myPointsBefore: number | null;
  myPointsAfter: number | null;
  multiplier: number | null;
};

export default function EventPopup({ event }: { event: EventViewProps | null }) {
  const [seenEventId, setSeenEventId] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  // 새 이벤트가 도착했을 때만(렌더 중 프롭 변화 감지) 최초 1회 팝업을 띄운다.
  // useEffect로 하면 렌더 이후 별도 커밋이 발생해 화면이 깜빡이므로,
  // 렌더 중 상태 조정(React가 권장하는 "state adjustment during render") 방식을 쓴다.
  if (event && event.id !== seenEventId) {
    setSeenEventId(event.id);
    const key = `seen_event_${event.id}`;
    const alreadySeen = typeof window !== "undefined" && sessionStorage.getItem(key);
    if (!alreadySeen) {
      setShowPopup(true);
      if (typeof window !== "undefined") sessionStorage.setItem(key, "1");
    }
  }

  if (!event) return null;

  const hasDelta = event.myDelta !== null;

  return (
    <>
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-6">
          <div className="animate-pop-in flex w-full max-w-sm flex-col items-center gap-3 border-[3px] border-ink bg-paper-2 p-7 text-center shadow-sticker">
            <span className="flex h-12 w-12 items-center justify-center border-2 border-ink bg-event text-white">
              <span className="icon-bolt" style={{ width: 16, height: 26 }} />
            </span>
            <p className="text-lg font-black">{event.title}</p>
            {hasDelta ? (
              <>
                <p className="text-sm font-semibold text-ink-soft">
                  변경 전 보유 포인트: {event.myPointsBefore!.toLocaleString()}P
                </p>
                <p
                  className={
                    "font-black " + (event.myDelta! >= 0 ? "text-win-ink" : "text-lose-ink")
                  }
                >
                  점수 변화: {event.myDelta! >= 0 ? "+" : ""}
                  {event.myDelta!.toLocaleString()}P
                </p>
                <p className="text-xl font-black">
                  현재 보유 포인트: {event.myPointsAfter!.toLocaleString()}P
                </p>
              </>
            ) : (
              <p className="text-sm font-semibold text-ink-soft">
                이번 라운드는 배팅한 포인트의 {event.multiplier}배를
                <br />
                얻거나 잃게 됩니다.
              </p>
            )}
            <button
              onClick={() => setShowPopup(false)}
              className="mt-2 w-full border-2 border-ink bg-event py-3 font-black text-white shadow-sticker-sm"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
