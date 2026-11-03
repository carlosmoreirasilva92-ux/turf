import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, BookOpen, CalendarDays, ChevronDown, Flag, SunMedium } from "lucide-react";
import type { ReactNode } from "react";
import { Mark } from "@/components/mark";
import { UserButton } from "@/lib/auth/gates";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Hoje", icon: CalendarDays },
  { to: "/corridas", label: "Corridas", icon: Flag },
  { to: "/analises", label: "Análises", icon: Activity },
  { to: "/caderno", label: "Caderno", icon: BookOpen },
] as const;

const MORE = [
  { to: "/livro", label: "Livro" },
  { to: "/como", label: "Como funciona" },
  { to: "/cavalos", label: "Cavalos" },
  { to: "/arquivo", label: "Arquivo" },
  { to: "/catalogo", label: "Catálogo" },
] as const;

function isActive(path: string, to: string) {
  if (to === "/") return path === "/" || path.startsWith("/ao-vivo");
  if (to === "/corridas") return path.startsWith("/corridas") || path.startsWith("/corrida");
  if (to === "/analises") return path.startsWith("/analises");
  if (to === "/caderno") return path.startsWith("/caderno");
  return path.startsWith(to);
}

export function Shell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const demo = path.startsWith("/caderno") || path.startsWith("/agentes") || path.startsWith("/corrida/");

  return (
    <div className="app-root min-h-dvh bg-[#0c1012] text-[#e8ede9]">
      <a href="#conteudo" className="skip-link">
        Saltar para o conteúdo
      </a>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-white/8 bg-[#0e1215] px-4 py-8 md:flex">
        <Link to="/" className="flex items-center gap-3 px-2" aria-label="Turf, início">
          <span className="flex size-10 items-center justify-center rounded-[11px] border border-[#b5d8c8]/16 bg-[#b5d8c8]/8 text-[#b5d8c8]">
            <Mark className="size-7" />
          </span>
          <span className="font-display text-[2rem] leading-none tracking-tight">
            Turf<span className="text-[#b5d8c8]">.</span>
          </span>
        </Link>
        <p className="mt-8 px-3 text-[10px] tracking-[0.18em] text-[#7c8a8b]">SUA MESA</p>
        <nav className="mt-2 flex flex-col" aria-label="Principal">
          {NAV.map((item) => {
            const active = isActive(path, item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-[9px] px-3 text-[13px]",
                  active ? "border border-[#b5d8c8]/16 bg-[#b5d8c8]/10 text-[#b5d8c8]" : "text-[#9aa6a5]",
                )}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <nav className="mt-4 border-t border-white/8 pt-3" aria-label="Mais secções">
          {MORE.map((item) => (
            <Link key={item.to} to={item.to} className="flex h-10 items-center rounded-[9px] px-3 text-[13px] text-[#9aa6a5]">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto px-2 pb-4">
          <p className="mb-3 flex items-start gap-2 text-xs text-[#e8ede9]">
            <span className={cn("mt-1 size-1.5 rounded-full", demo ? "bg-[#d8be87]" : "bg-[#b5d8c8]")} aria-hidden="true" />
            <span>
              {demo ? "Modo demonstração" : "Cartão real"}
              <small className="mt-0.5 block text-[#7c8a8b]">{demo ? "Exemplos, não o programa" : "Irlanda e Reino Unido"}</small>
            </span>
          </p>
          <UserButton />
        </div>
      </aside>

      <div className="md:pl-56">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/8 bg-[#0c1012]/90 px-4 backdrop-blur-md md:px-8">
          <Link to="/" className="flex items-center gap-2 md:hidden" aria-label="Turf, início">
            <span className="flex size-9 items-center justify-center rounded-[11px] border border-[#b5d8c8]/16 bg-[#b5d8c8]/8 text-[#b5d8c8]">
              <Mark className="size-6" />
            </span>
            <span className="font-display text-[1.85rem] leading-none">
              Turf<span className="text-[#b5d8c8]">.</span>
            </span>
          </Link>
          <p className="hidden text-xs text-[#7c8a8b] md:block">
            Mesa de corridas <span className="mx-2">›</span> <strong className="font-medium text-[#e8ede9]">Hoje</strong>
          </p>
          <div className="flex items-center gap-2">
            <Link
              to={demo ? "/" : "/caderno"}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-[#13191c] px-3 text-[11px]"
            >
              <span className={cn("size-1.5 rounded-full", demo ? "bg-[#d8be87]" : "bg-[#b5d8c8]")} aria-hidden="true" />
              {demo ? "Demonstração" : "Cartão real"}
              <ChevronDown className="size-3 text-[#7c8a8b]" aria-hidden="true" />
            </Link>
            <span className="inline-flex size-9 items-center justify-center text-[#9aa6a5]" aria-hidden="true">
              <SunMedium className="size-[18px]" />
            </span>
          </div>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-3xl px-4 pt-4 pb-28 md:px-8 md:pt-7 md:pb-16">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/12 bg-[#0e1215]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden" aria-label="Principal">
        <ul className="grid h-[68px] grid-cols-4">
          {NAV.map((item) => {
            const active = isActive(path, item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-full flex-col items-center justify-center gap-1 text-[11px]",
                    active ? "text-[#b5d8c8]" : "text-[#7c8a8b]",
                  )}
                >
                  {active ? <span className="absolute top-0 h-0.5 w-6 rounded-b bg-[#b5d8c8]" /> : null}
                  <Icon className="size-5" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
