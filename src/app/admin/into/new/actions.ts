"use server";

import { prisma } from "@/lib/prisma";
import { generateRoomCode, generateTeamToken, generateAdminToken } from "@/lib/codes";
import { redirect } from "next/navigation";

export async function createRoom(formData: FormData) {
  const team1Name = (formData.get("team1Name") as string)?.trim() || "1팀";
  const team2Name = (formData.get("team2Name") as string)?.trim() || "2팀";
  const startPointsRaw = formData.get("startPoints") as string;
  const startPoints = startPointsRaw ? BigInt(Math.trunc(Number(startPointsRaw))) : BigInt(500);

  if (!Number.isFinite(Number(startPointsRaw)) && startPointsRaw) {
    throw new Error("시작 포인트는 숫자여야 합니다");
  }

  let code = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateRoomCode();
    const existing = await prisma.room.findUnique({ where: { code: candidate } });
    if (!existing) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    throw new Error("게임방 코드를 생성하지 못했습니다. 다시 시도해주세요");
  }

  const adminToken = generateAdminToken();
  const team1Token = generateTeamToken();
  const team2Token = generateTeamToken();

  const room = await prisma.room.create({
    data: {
      code,
      adminToken,
      team1Name,
      team2Name,
      startPoints,
      teams: {
        create: [
          { teamNo: 1, name: team1Name, accessToken: team1Token, currentPoints: startPoints },
          { teamNo: 2, name: team2Name, accessToken: team2Token, currentPoints: startPoints },
        ],
      },
      rounds: {
        create: [{ roundNo: 1 }],
      },
    },
  });

  redirect(`/admin/${room.code}/${room.adminToken}`);
}
