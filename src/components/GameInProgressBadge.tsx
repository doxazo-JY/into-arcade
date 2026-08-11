// 두 팀 다 배팅 확정 후 진행자 판정을 기다리는 상태를 알려주는 배지.
// 팀 화면 전용 — 진행자 화면은 같은 상태에서 판정 폼(ResultForm)이
// 바로 뜨니 배지가 중복이라 안 씀.
export default function GameInProgressBadge() {
  return (
    <div className="flex items-center justify-center gap-3 border-[3px] border-ink bg-paper-2 px-6 py-4 shadow-sticker-sm">
      <div className="flex gap-1.5">
        <span className="wait-dot h-2.5 w-2.5 rounded-full bg-ink" />
        <span className="wait-dot h-2.5 w-2.5 rounded-full bg-ink" />
        <span className="wait-dot h-2.5 w-2.5 rounded-full bg-ink" />
      </div>
      <p className="text-lg font-black">게임 진행 중</p>
    </div>
  );
}
