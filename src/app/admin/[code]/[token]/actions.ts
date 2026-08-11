"use server";

import { prisma } from "@/lib/prisma";
import { assertAdmin, getCurrentRound } from "@/lib/admin";
import { computeFinalBetAmount, applyMultiplier } from "@/lib/game";
import { revalidatePath } from "next/cache";
import type { Outcome } from "@/generated/prisma/client";

function refresh(roomCode: string, adminToken: string) {
  revalidatePath(`/admin/${roomCode}/${adminToken}`);
}

export async function startRound(roomCode: string, adminToken: string) {
  const room = await assertAdmin(roomCode, adminToken);
  const round = await getCurrentRound(room.id, room.currentRound);

  if (round.status !== "WAITING") {
    throw new Error("이미 시작된 라운드입니다");
  }

  await prisma.round.update({
    where: { id: round.id },
    data: { status: "BETTING" },
  });

  if (room.status === "SETUP") {
    await prisma.room.update({ where: { id: room.id }, data: { status: "ACTIVE" } });
  }

  refresh(roomCode, adminToken);
}

export async function applyRoundResult(
  roomCode: string,
  adminToken: string,
  winningTeamNo: number
) {
  const room = await assertAdmin(roomCode, adminToken);
  const round = await getCurrentRound(room.id, room.currentRound);

  if (round.status === "RESOLVED") {
    throw new Error("이미 결과가 적용된 라운드입니다");
  }
  if (winningTeamNo !== 1 && winningTeamNo !== 2) {
    throw new Error("승리 팀을 선택해주세요");
  }

  const teams = await prisma.team.findMany({ where: { roomId: room.id }, orderBy: { teamNo: "asc" } });
  const multiplier = Number(round.multiplier);
  const outcomes: Record<number, Outcome> = {
    1: winningTeamNo === 1 ? "WIN" : "LOSE",
    2: winningTeamNo === 2 ? "WIN" : "LOSE",
  };

  await prisma.$transaction(async (tx) => {
    for (const team of teams) {
      const outcome = outcomes[team.teamNo];
      const finalBet = await computeFinalBetAmount(round.id, team.id);
      // 배수는 승패 양쪽에 동일하게 적용된다. 이긴 팀은 배팅액 × 배수를 얻고,
      // 진 팀도 배팅액 × 배수를 잃는다.
      const magnitude = applyMultiplier(finalBet, multiplier);
      const delta = outcome === "WIN" ? magnitude : -magnitude;
      const before = team.currentPoints;
      const after = before + delta;

      const result = await tx.roundResult.create({
        data: {
          roundId: round.id,
          teamId: team.id,
          outcome,
          finalBetAmount: finalBet,
          applied: true,
          appliedAt: new Date(),
        },
      });

      await tx.team.update({ where: { id: team.id }, data: { currentPoints: after } });

      await tx.scoreTransaction.create({
        data: {
          roomId: room.id,
          roundId: round.id,
          teamId: team.id,
          sourceType: "BET_RESULT",
          sourceId: result.id,
          pointsBefore: before,
          pointsDelta: delta,
          pointsAfter: after,
        },
      });
    }

    await tx.round.update({ where: { id: round.id }, data: { status: "RESOLVED" } });
  });

  refresh(roomCode, adminToken);
}

// 진행자가 승/패를 잘못 눌렀을 때 쓰는 정정 기능. 되돌리기(revert 후
// 재판정) 대신 기존 RoundResult를 그 자리에서 업데이트하고 차액만큼
// 보정 트랜잭션 하나를 적용한다 — RoundResult는 (roundId, teamId)
// 유니크 제약이 있어서 되돌린 뒤 다시 create하면 충돌하고, 굳이 라운드를
// RESULT_PENDING 같은 중간 상태로 되돌릴 필요도 없다는 판단(2026-08-11).
// "다음 라운드"를 누르기 전, 즉 이 라운드가 여전히 현재 라운드일 때만
// 호출되는 화면에만 노출한다.
export async function correctRoundResult(
  roomCode: string,
  adminToken: string,
  winningTeamNo: number
) {
  const room = await assertAdmin(roomCode, adminToken);
  const round = await getCurrentRound(room.id, room.currentRound);

  if (round.status !== "RESOLVED") {
    throw new Error("아직 결과가 나오지 않은 라운드입니다");
  }
  if (winningTeamNo !== 1 && winningTeamNo !== 2) {
    throw new Error("승리 팀을 선택해주세요");
  }

  const teams = await prisma.team.findMany({ where: { roomId: room.id }, orderBy: { teamNo: "asc" } });
  const results = await prisma.roundResult.findMany({
    where: { roundId: round.id, reverted: false },
  });
  if (results.length !== teams.length) {
    throw new Error("정정할 결과를 찾을 수 없습니다");
  }

  const multiplier = Number(round.multiplier);
  const newOutcomes: Record<number, Outcome> = {
    1: winningTeamNo === 1 ? "WIN" : "LOSE",
    2: winningTeamNo === 2 ? "WIN" : "LOSE",
  };

  const alreadyApplied = teams.every(
    (team) => results.find((r) => r.teamId === team.id)?.outcome === newOutcomes[team.teamNo]
  );
  if (alreadyApplied) {
    throw new Error("이미 그 결과로 적용되어 있습니다");
  }

  await prisma.$transaction(async (tx) => {
    for (const team of teams) {
      const result = results.find((r) => r.teamId === team.id)!;
      const newOutcome = newOutcomes[team.teamNo];
      if (result.outcome === newOutcome) continue;

      const magnitude = applyMultiplier(result.finalBetAmount, multiplier);
      const oldDelta = result.outcome === "WIN" ? magnitude : -magnitude;
      const newDelta = newOutcome === "WIN" ? magnitude : -magnitude;
      const correctionDelta = newDelta - oldDelta;

      const before = team.currentPoints;
      const after = before + correctionDelta;

      await tx.team.update({ where: { id: team.id }, data: { currentPoints: after } });

      await tx.scoreTransaction.create({
        data: {
          roomId: room.id,
          roundId: round.id,
          teamId: team.id,
          sourceType: "BET_RESULT",
          sourceId: result.id,
          pointsBefore: before,
          pointsDelta: correctionDelta,
          pointsAfter: after,
          memo: "결과 정정",
        },
      });

      await tx.roundResult.update({ where: { id: result.id }, data: { outcome: newOutcome } });
    }
  });

  refresh(roomCode, adminToken);
}

export async function setParticipantsLocked(
  roomCode: string,
  adminToken: string,
  locked: boolean
) {
  const room = await assertAdmin(roomCode, adminToken);
  await prisma.room.update({ where: { id: room.id }, data: { participantsLocked: locked } });
  refresh(roomCode, adminToken);
}

export async function nextRound(roomCode: string, adminToken: string) {
  const room = await assertAdmin(roomCode, adminToken);
  const round = await getCurrentRound(room.id, room.currentRound);

  if (round.status !== "RESOLVED") {
    throw new Error("현재 라운드 결과가 아직 적용되지 않았습니다");
  }

  const nextRoundNo = room.currentRound + 1;
  await prisma.$transaction([
    prisma.room.update({ where: { id: room.id }, data: { currentRound: nextRoundNo } }),
    prisma.round.create({ data: { roomId: room.id, roundNo: nextRoundNo } }),
  ]);

  refresh(roomCode, adminToken);
}
