"use client";

import { useState } from "react";
import RoundControls from "./RoundControls";
import EventPanel from "./EventPanel";

// 이벤트 확인/실행이 끝나지 않은 상태에서 "라운드 시작"을 눌러 이벤트 없이
// 라운드가 진행되는 실수를 막기 위해, 이벤트 패널이 열려있는 동안(picked 상태)
// 라운드 시작 버튼을 비활성화한다.
export default function GameFlowPanel({
  roomCode,
  adminToken,
  roundNo,
  roundStatus,
  team1Name,
  team2Name,
  team1Points,
  team2Points,
}: {
  roomCode: string;
  adminToken: string;
  roundNo: number;
  roundStatus: string;
  team1Name: string;
  team2Name: string;
  team1Points: number;
  team2Points: number;
}) {
  const [eventBusy, setEventBusy] = useState(false);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="w-full">
        <EventPanel
          roomCode={roomCode}
          adminToken={adminToken}
          roundStatus={roundStatus}
          team1Name={team1Name}
          team2Name={team2Name}
          team1Points={team1Points}
          team2Points={team2Points}
          onBusyChange={setEventBusy}
        />
      </div>
      {roundStatus === "WAITING" && (
        <RoundControls
          roomCode={roomCode}
          adminToken={adminToken}
          roundNo={roundNo}
          roundStatus={roundStatus}
          disabled={eventBusy}
        />
      )}
    </div>
  );
}
