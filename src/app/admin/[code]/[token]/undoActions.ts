"use server";

import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin";
import { applyScoreDelta } from "@/lib/game";
import { revalidatePath } from "next/cache";

function refresh(roomCode: string, adminToken: string) {
  revalidatePath(`/admin/${roomCode}/${adminToken}`);
  revalidatePath(`/admin/${roomCode}/${adminToken}/history`);
}

type UndoResult = { ok: boolean; warning?: string; laterCount?: number };

export async function manualAdjustScore(
  roomCode: string,
  adminToken: string,
  teamNo: number,
  mode: "delta" | "set",
  value: number,
  memo?: string
) {
  const room = await assertAdmin(roomCode, adminToken);
  if (room.status === "ENDED") {
    throw new Error("게임이 종료된 방은 점수를 수정할 수 없습니다");
  }
  if (!Number.isFinite(value)) {
    throw new Error("올바른 값을 입력해주세요");
  }

  const team = await prisma.team.findFirst({ where: { roomId: room.id, teamNo } });
  if (!team) {
    throw new Error("팀을 찾을 수 없습니다");
  }

  const delta =
    mode === "delta" ? BigInt(Math.trunc(value)) : BigInt(Math.trunc(value)) - team.currentPoints;

  await prisma.$transaction(async (tx) => {
    await applyScoreDelta(tx, {
      roomId: room.id,
      teamId: team.id,
      delta,
      sourceType: "MANUAL_ADJUST",
      memo: memo || null,
    });
  });

  refresh(roomCode, adminToken);
}

async function countLaterTransactions(teamId: string, after: Date) {
  return prisma.scoreTransaction.count({
    where: { teamId, createdAt: { gt: after } },
  });
}

export async function undoEvent(
  roomCode: string,
  adminToken: string,
  eventLogId: string,
  force = false
): Promise<UndoResult> {
  const room = await assertAdmin(roomCode, adminToken);

  const event = await prisma.eventLog.findFirst({
    where: { id: eventLogId, roomId: room.id },
  });
  if (!event) {
    throw new Error("이벤트를 찾을 수 없습니다");
  }
  if (event.reverted) {
    throw new Error("이미 되돌린 이벤트입니다");
  }

  // 배팅 배수는 라운드가 시작(BETTING)된 뒤에 취소하면 이미 그 배수를 보고
  // 배팅한 팀이 있을 수 있어 흐름이 꼬인다 — 라운드 시작 전(WAITING)에만
  // 취소를 허용한다.
  if (event.eventType === "BET_MULTIPLIER" && event.roundId) {
    const round = await prisma.round.findUnique({ where: { id: event.roundId } });
    if (round && round.status !== "WAITING") {
      throw new Error("라운드가 시작된 뒤에는 배팅 배수 이벤트를 취소할 수 없습니다");
    }
  }

  const txs = await prisma.scoreTransaction.findMany({
    where: { eventLogId: event.id },
  });

  let laterCount = 0;
  for (const tx of txs) {
    laterCount += await countLaterTransactions(tx.teamId, tx.createdAt);
  }
  if (laterCount > 0 && !force) {
    return { ok: false, warning: "later_changes", laterCount };
  }

  await prisma.$transaction(async (tx) => {
    for (const scoreTx of txs) {
      await applyScoreDelta(tx, {
        roomId: room.id,
        roundId: scoreTx.roundId,
        teamId: scoreTx.teamId,
        delta: -scoreTx.pointsDelta,
        sourceType: "REVERT",
        sourceId: scoreTx.id,
        memo: "이벤트 되돌리기",
      });
    }

    if (event.eventType === "BET_MULTIPLIER" && event.roundId) {
      await tx.round.update({ where: { id: event.roundId }, data: { multiplier: 1 } });
    }

    await tx.eventLog.update({ where: { id: event.id }, data: { reverted: true, revertedAt: new Date() } });
  });

  refresh(roomCode, adminToken);
  return { ok: true };
}
