import { prisma } from "@/lib/prisma";

// 방을 새로 만들 때마다 팀 링크를 다시 배포할 필요가 없도록, "가장
// 최근에 만든 방"을 곧 "지금 진행 중인 방"으로 취급한다. 별도 상태 테이블
// 없이 createdAt 정렬만으로 충분 — 방은 삭제되지 않고 계속 쌓이기만 한다.
export async function getCurrentRoom() {
  return prisma.room.findFirst({
    orderBy: { createdAt: "desc" },
    include: { teams: { orderBy: { teamNo: "asc" } } },
  });
}
