import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Camera, Layers3, Mic, Sparkles, UsersRound } from "lucide-react";

export const metadata: Metadata = {
  title: "Connection beta",
  description: "what Connection is today and what is coming next."
};

const today = [
  {
    icon: UsersRound,
    title: "small circles",
    body: "connect with people directly, then keep private group spaces for family, partners, trips, and projects."
  },
  {
    icon: Camera,
    title: "photo memory feed",
    body: "post in the moment instead of choosing from a thousand photos later, then revisit your shared memory lane."
  },
  {
    icon: CalendarDays,
    title: "intimate calendar",
    body: "plan across countries without doing timezone math. the event stays universal, each person sees their own time."
  }
];

const next = [
  {
    icon: Layers3,
    title: "projects",
    body: "a new place for creative plans, hobbies, references, checklists, and the moments that help the idea become real."
  },
  {
    icon: Mic,
    title: "voice memories",
    body: "record important audio, transcribe it, and save it privately so it can later become a note, plan, or project idea."
  },
  {
    icon: Sparkles,
    title: "connection camera",
    body: "a tiny hardware companion with a built-in mic that queues photos, voice notes, and project sparks back into Connection."
  }
];

export default function BetaPage() {
  return (
    <main className="min-h-screen bg-[#151512] px-5 py-6 text-[#f7f4ee] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#f7f4ee]/75 transition hover:text-[#f7f4ee]"
            href="/"
          >
            <ArrowLeft size={17} />
            back to app
          </Link>
          <span className="rounded-full bg-[#d8f4ff] px-3 py-1 text-[0.64rem] font-bold uppercase tracking-[0.22em] text-[#13242b]">
            beta
          </span>
        </header>

        <section className="grid gap-8 py-10 lg:grid-cols-[1fr_0.82fr] lg:items-end">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-[#c87958]">connection first</p>
            <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[0.95] tracking-normal sm:text-7xl">
              your people, photos, groups, and plans together.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#f7f4ee]/62">
              Connection is a private space for the people closest to you and the creative hobbies you want to keep alive.
              it stays quiet, removes friction, and helps you capture the moment while you are still inside it.
            </p>
          </div>

          <div className="rounded-2xl border border-white/12 bg-[#23231f] p-5 shadow-2xl shadow-black/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.64rem] font-bold uppercase tracking-[0.24em] text-[#b9deef]">hardware companion</p>
                <p className="mt-2 text-xl font-semibold text-[#f7f4ee]">connection camera</p>
                <p className="mt-2 text-sm leading-6 text-[#f7f4ee]/58">
                  a small raspberry-pi-style companion with a built-in mic for photos, voice notes, and project context.
                </p>
              </div>
              <span className="rounded-full bg-[#d8f4ff] px-3 py-1 text-[0.58rem] font-bold uppercase tracking-[0.2em] text-[#13242b]">
                sketch
              </span>
            </div>

            <div className="mt-6 rounded-2xl border border-dashed border-white/18 bg-black/18 p-4">
              <div className="relative mx-auto h-52 max-w-sm">
                <div className="absolute left-5 top-8 h-32 w-36 rotate-[-2deg] rounded-[1.35rem] border-2 border-[#f7f4ee]/55 bg-[#20201c] shadow-2xl shadow-black/20">
                  <div className="absolute left-5 top-5 grid h-12 w-12 place-items-center rounded-full border border-[#f7f4ee]/40 bg-black/30">
                    <div className="h-6 w-6 rounded-full bg-[#0e0e0c] ring-4 ring-[#f7f4ee]/20" />
                  </div>
                  <div className="absolute bottom-5 left-5 flex gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#f7f4ee]/65" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#f7f4ee]/65" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#f7f4ee]/65" />
                  </div>
                  <span className="absolute right-5 top-6 h-2.5 w-2.5 rounded-full bg-[#9fe4a7] shadow-[0_0_16px_rgba(159,228,167,0.7)]" />
                  <div className="absolute bottom-4 right-4 h-9 w-3 rounded-full border border-[#f7f4ee]/35" />
                </div>

                <div className="absolute left-[9.5rem] top-8 space-y-2">
                  <div className="h-2 w-16 rounded-full bg-[#b9deef]/75" />
                  <div className="h-2 w-24 rounded-full bg-[#b9deef]/45" />
                  <div className="h-2 w-12 rounded-full bg-[#b9deef]/65" />
                </div>

                <div className="absolute bottom-5 right-0 w-44 rounded-2xl border border-white/12 bg-[#151512] p-3">
                  <p className="text-[0.58rem] font-bold uppercase tracking-[0.2em] text-[#f7f4ee]/45">queued</p>
                  <div className="mt-3 space-y-2 text-sm font-semibold">
                    <p>photo to family</p>
                    <p className="text-[#f7f4ee]/60">voice note to project</p>
                    <p className="text-[#f7f4ee]/60">memory lane</p>
                  </div>
                </div>

                <div className="absolute bottom-14 left-0 flex items-end gap-1">
                  {[18, 34, 22, 42, 28, 38, 16].map((height, index) => (
                    <span
                      className="w-1.5 rounded-full bg-[#c87958]/80"
                      key={`${height}-${index}`}
                      style={{ height }}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 p-3">
                  <p className="font-semibold">instant share</p>
                  <p className="mt-1 text-[#f7f4ee]/52">less sorting later</p>
                </div>
                <div className="rounded-xl border border-white/10 p-3">
                  <p className="font-semibold">built-in mic</p>
                  <p className="mt-1 text-[#f7f4ee]/52">thoughts to text</p>
                </div>
                <div className="rounded-xl border border-white/10 p-3">
                  <p className="font-semibold">projects</p>
                  <p className="mt-1 text-[#f7f4ee]/52">ideas become plans</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 py-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-[#c87958]">what it does now</p>
              <h2 className="mt-3 text-3xl font-semibold">simple, private, already useful.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-[#f7f4ee]/52">
              the beta is focused on the daily rhythm first: capture the moment, share it to the right place, plan with
              less friction, and come back without noise.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {today.map((item) => (
              <article className="rounded-2xl border border-white/10 bg-[#20201c] p-5" key={item.title}>
                <item.icon className="text-[#b9deef]" size={21} />
                <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#f7f4ee]/58">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 py-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-[#c87958]">what is next</p>
              <h2 className="mt-3 text-3xl font-semibold">from memories to creative momentum.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-[#f7f4ee]/52">
              the next direction is less about posting more and more about keeping relationships close while helping real
              life ideas move.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {next.map((item) => (
              <article className="rounded-2xl border border-white/10 bg-[#20201c] p-5" key={item.title}>
                <item.icon className="text-[#b9deef]" size={21} />
                <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#f7f4ee]/58">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 py-8">
          <div className="rounded-2xl border border-white/10 bg-[#23231f] p-6">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-[#c87958]">beta note</p>
            <p className="mt-4 max-w-3xl text-xl leading-9 text-[#f7f4ee]/72">
              this is still small on purpose. the goal is to keep the app intimate, useful, and calm before opening it up
              to more people.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
