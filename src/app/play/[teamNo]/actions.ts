"use server";

import { prisma } from "@/lib/prisma";
import { toBigIntPoints, isValidBetAmount } from "@/lib/points";
import { getCurrentRound } from "@/lib/admin";
import { getCurrentRoom } from "@/lib/currentRoom";
import { revalidatePath } from "next/cache";

// 팀 접속은 토큰이 아니라 "지금 진행 중인(가장 최근에 만든) 방"과 팀
// 번호만으로 이뤄진다 — 참가자에게 공유되지 않는 URL이라는 것 자체가
// 유일한 보호이다.
async function requireTeam(teamNo: 1 | 2) {
  const room = await getCurrentRoom();
  if (!room) {
    throw new Error("진행 중인 게임방이 없습니다");
  }

  const team = room.teams.find((t) => t.teamNo === teamNo);
  if (!team) {
    throw new Error("팀 정보를 찾을 수 없습니다");
  }

  return { room, team };
}

// 팀 이름은 방 생성 시 진행자가 기본값("1팀"/"2팀")으로 남겨뒀을 때만
// 입장 화면에서 한 번 입력받는다 — 진행자가 이미 실제 이름을 정했으면
// 다시 물어보지 않는다(이름이 기본값이 아니게 된 시점부터는 "이미 정해짐"
// 으로 간주). 진행자 화면에 그대로 노출되는 값이라 언제든 바꿀 수 있게
// 하진 않음 — 입장 시 한 번만.
export async function setTeamName(teamNo: 1 | 2, name: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 20) {
    throw new Error("팀 이름은 1~20자로 입력해주세요");
  }

  const { team } = await requireTeam(teamNo);
  const defaultName = teamNo === 1 ? "1팀" : "2팀";
  if (team.name !== defaultName) {
    throw new Error("이미 팀 이름이 설정되어 있습니다");
  }

  await prisma.team.update({ where: { id: team.id }, data: { name: trimmed } });
  revalidatePath(`/play/${teamNo}`);
}

export async function confirmBet(teamNo: 1 | 2, amount: number) {
  if (!isValidBetAmount(amount)) {
    throw new Error("올바른 배팅 금액을 입력해주세요");
  }

  const { room, team } = await requireTeam(teamNo);
  const round = await getCurrentRound(room.id, room.currentRound);

  if (round.status !== "BETTING") {
    throw new Error("지금은 배팅할 수 있는 시간이 아닙니다");
  }

  const existing = await prisma.bet.findUnique({
    where: { roundId_teamId: { roundId: round.id, teamId: team.id } },
  });
  if (existing?.confirmed) {
    throw new Error("이미 배팅을 확정했습니다");
  }

  const maxBet = team.currentPoints > BigInt(0) ? team.currentPoints : room.negativeBetLimit;
  const betAmount = toBigIntPoints(amount);
  if (betAmount > maxBet) {
    throw new Error(`배팅 가능한 최대 금액은 ${maxBet.toLocaleString()}P 입니다`);
  }

  await prisma.bet.upsert({
    where: { roundId_teamId: { roundId: round.id, teamId: team.id } },
    create: {
      roundId: round.id,
      teamId: team.id,
      amount: betAmount,
      confirmed: true,
      confirmedAt: new Date(),
    },
    update: {
      amount: betAmount,
      confirmed: true,
      confirmedAt: new Date(),
    },
  });

  revalidatePath(`/play/${teamNo}`);
}
