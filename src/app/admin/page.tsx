import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import LinksPanel from "@/components/LinksPanel";
import SceneDecoration from "@/components/SceneDecoration";
import DeleteRoomButton from "./DeleteRoomButton";
import RelinkRoomButton from "./RelinkRoomButton";

// 방 목록(진행자 토큰 포함)을 보여주는 페이지라 참가자에게 공유되지 않는다.
// 이 URL을 안다는 것 자체가 유일한 보호 — /play가 인증 없이 코드만으로
// 열리는 것과 같은 방식.
export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const rooms = await prisma.room.findMany({
    orderBy: { createdAt: "desc" },
    include: { teams: { orderBy: { teamNo: "asc" } } },
  });

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = host?.startsWith("localhost") || host?.startsWith("192.168") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-6 py-10">
      <SceneDecoration />
      <h1 className="relative z-10 text-2xl font-black">진행자 홈</h1>

      <div className="relative z-10 flex flex-col gap-6">
      <Link
        href="/new"
        className="border-2 border-ink bg-team-red px-6 py-5 text-center text-lg font-black text-white shadow-sticker-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
      >
        ▶ 새 게임방 만들기
      </Link>

      <section className="flex flex-col gap-2">
        <p className="text-sm font-black text-ink-soft">
          참가자 공유 링크 (수련회 시작할 때 한 번만 전달하면 됨)
        </p>
        <p className="text-xs font-semibold text-ink-faint">
          이 링크들은 항상 &ldquo;현재 진행 중인 방&rdquo;(가장 최근에 만든 방)으로 연결돼요. 새
          방을 만들어도 다시 보낼 필요 없습니다.
        </p>
        <LinksPanel
          links={[
            { label: "1팀 접속", url: `${origin}/play/1` },
            { label: "2팀 접속", url: `${origin}/play/2` },
          ]}
          defaultOpen
        />
      </section>

      <section className="flex flex-col gap-3">
        <p className="text-sm font-black text-ink-soft">게임방 기록</p>
        {rooms.length === 0 && (
          <p className="text-sm font-semibold text-ink-faint">아직 만든 게임방이 없습니다.</p>
        )}
        {rooms.map((room, i) => (
          <div key={room.id} className="flex items-stretch gap-2">
            <Link
              href={`/admin/${room.code}/${room.adminToken}`}
              className="flex flex-1 flex-col gap-1 border-2 border-ink bg-paper-2 p-4 shadow-sticker-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-black">{room.code}</span>
                {i === 0 && (
                  <span className="border-2 border-ink bg-win px-2 py-0.5 text-xs font-black text-ink">
                    현재 진행 중
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-ink-soft">
                {room.teams[0]?.name} vs {room.teams[1]?.name}
              </p>
              <p className="text-xs font-semibold text-ink-faint">
                {room.createdAt.toLocaleString("ko-KR")}
              </p>
            </Link>
            {i !== 0 && <RelinkRoomButton code={room.code} adminToken={room.adminToken} />}
            <DeleteRoomButton code={room.code} adminToken={room.adminToken} />
          </div>
        ))}
      </section>
      </div>
    </main>
  );
}
