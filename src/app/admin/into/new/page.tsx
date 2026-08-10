import Link from "next/link";
import { createRoom } from "./actions";

export default function NewRoomPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">게임방 만들기</h1>
        <Link href="/admin/into" className="text-sm font-bold text-team-blue-ink underline">
          진행자 홈으로
        </Link>
      </div>
      <form action={createRoom} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">1팀 이름</span>
          <input
            name="team1Name"
            defaultValue="1팀"
            className="border-2 border-ink bg-paper-2 px-4 py-3 text-lg"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">2팀 이름</span>
          <input
            name="team2Name"
            defaultValue="2팀"
            className="border-2 border-ink bg-paper-2 px-4 py-3 text-lg"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">시작 포인트</span>
          <input
            name="startPoints"
            type="number"
            defaultValue={500}
            inputMode="numeric"
            className="border-2 border-ink bg-paper-2 px-4 py-3 text-lg"
          />
        </label>
        <button
          type="submit"
          className="mt-2 border-2 border-ink bg-team-red px-6 py-4 text-lg font-black text-white shadow-sticker-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          게임방 만들기
        </button>
      </form>
    </main>
  );
}
