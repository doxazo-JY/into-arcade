// 두 팀 다 배팅을 확정하고 진행자 판정을 기다리는 상태 — 팀 화면과
// 팀 화면에서 두 팀 다 배팅 확정 후 판정 대기 상태를 알려주는 배지.
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
