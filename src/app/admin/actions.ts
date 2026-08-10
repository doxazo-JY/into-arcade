"use server";

import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";

// 방 삭제는 Team/Round 쪽 relation이 전부 onDelete: Cascade라 방 하나
// 지우면 배팅/결과/이벤트/점수 기록까지 통째로 같이 지워진다.
export async function deleteRoom(roomCode: string, adminToken: string) {
  const room = await assertAdmin(roomCode, adminToken);
  await prisma.room.delete({ where: { id: room.id } });
  revalidatePath("/admin/into");
}

// "현재 방"은 별도 상태값 없이 createdAt이 가장 최신인 방으로 정하므로
// (getCurrentRoom 참고), 과거 방을 다시 현재로 만들려면 createdAt을 지금
// 시각으로 갱신하는 것으로 충분하다 — 스키마 변경 없이 재사용 가능.
// 부작용: 그 방의 "생성 시각" 표시가 실제 최초 생성 시각이 아니라 마지막
// 연결 시각으로 바뀐다(사용 빈도가 낮은 기능이라 감수하기로 함).
export async function relinkRoom(roomCode: string, adminToken: string) {
  const room = await assertAdmin(roomCode, adminToken);
  await prisma.room.update({ where: { id: room.id }, data: { createdAt: new Date() } });
  revalidatePath("/admin/into");
  revalidatePath(`/admin/${roomCode}/${adminToken}`);
}
