import Link from "next/link";
import Image from "next/image";
import { getCurrentRoom } from "@/lib/currentRoom";
import HomeGate from "@/components/HomeGate";
import SceneDecoration from "@/components/SceneDecoration";

// 참가자 잠금 여부를 매번 새로 확인해야 하는 페이지라 캐싱하면 안 된다.
export const dynamic = "force-dynamic";

export default async function Home() {
  const room = await getCurrentRoom();
  const locked = room?.participantsLocked ?? false;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-8 px-6 py-10 text-center max-sm:gap-5">
      <SceneDecoration />
      <Image
        src="/인투오락실.png"
        alt="2026 하계수련회 인투 오락실"
        width={1586}
        height={992}
        priority
        className="relative z-10 w-full max-sm:w-[78%]"
      />
      <div className="relative z-10 w-full max-sm:w-[78%]">
        <HomeGate locked={locked}>
          <div className="flex w-full flex-col gap-4">
            <Link
              href="/play/1"
              className="border-2 border-ink bg-team-red px-6 py-5 text-lg font-black text-white shadow-sticker-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              1팀 접속
            </Link>
            <Link
              href="/play/2"
              className="border-2 border-ink bg-team-blue px-6 py-5 text-lg font-black text-white shadow-sticker-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              2팀 접속
            </Link>
          </div>
        </HomeGate>
      </div>
    </main>
  );
}
