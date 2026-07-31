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
    body: "share photos to all connections or to one group, with simple captions and quiet notifications where they matter."
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
    title: "connection cam",
    body: "a tiny standalone camera and mic for travel and daily life, able to queue photos and thoughts back into Connection."
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
              Connection is a private space for the people closest to you. photos stay personal, groups stay intentional,
              and plans stay clear even when everyone lives in different timezones.
            </p>
          </div>

          <div className="rounded-2xl border border-white/12 bg-[#23231f] p-5 shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#f7f4ee]">current beta</p>
                <p className="mt-1 text-sm leading-6 text-[#f7f4ee]/58">invite-only while the foundation gets polished.</p>
              </div>
              <div className="flex -space-x-2">
                {["n", "p", "s"].map((letter) => (
                  <span
                    className="grid h-9 w-9 place-items-center rounded-full border border-[#23231f] bg-[#b9deef] text-sm font-bold text-[#111]"
                    key={letter}
                  >
                    {letter}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/18 p-4">
                <p className="text-[0.64rem] font-semibold uppercase tracking-[0.22em] text-[#f7f4ee]/45">group</p>
                <h2 className="mt-2 text-2xl font-semibold">family</h2>
                <p className="mt-2 text-sm leading-6 text-[#f7f4ee]/58">private photos and plans stay with the people in that group.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/18 p-4">
                <p className="text-[0.64rem] font-semibold uppercase tracking-[0.22em] text-[#f7f4ee]/45">notice</p>
                <h2 className="mt-2 text-2xl font-semibold">just now</h2>
                <p className="mt-2 text-sm leading-6 text-[#f7f4ee]/58">someone added dinner in your group calendar.</p>
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
              the beta is focused on the daily rhythm first: post, plan, notify, and come back without noise.
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
              the next direction is less about posting more and more about helping your real life ideas move.
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
