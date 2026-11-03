import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, BookOpen, CalendarDays, Flag } from "lucide-react";
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
  { to: "/cavalos", label: "Cavalos" },
  { to: "/arquivo", label: "Arquivo" },
  { to: "/joqueis", label: "Jóqueis" },
  { to: "/treinadores", label: "Treinadores" },
  { to: "/fontes", label: "Fontes" },
  { to: "/catalogo", label: "Catálogo" },
  { to: "/agentes", label: "Agentes" },
] as const;

function isActive(path: string, to: string) {
  if (to === "/") return path === "/" || path.startsWith("/ao-vivo");
  if (to === "/corridas") return path.startsWith("/corridas") || path.startsWith("/corrida");
  if (to === "/analises") return path.startsWith("/analises");
  if (to === "/caderno") return path.startsWith("/caderno") || path.startsWith("/agentes");
  return path.startsWith(to);
}

function demoPath(path: string) {
  return path.startsWith("/caderno") || path.startsWith("/agentes") || path.startsWith("/corrida/");
}

export function Shell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const demo = demoPath(path);

  return (
    <div className="app-root min-h-dvh text-fg">
      <a href="#conteudo" className="skip-link">
        Saltar para o conteúdo
      </a>
      <aside className="glass-nav fixed inset-y-3 left-3 z-20 hidden w-52 flex-col overflow-y-auto rounded-[1.75rem] px-4 py-6 md:flex">
        <Link to="/" aria-label="Turf, cartão de hoje" className="flex items-center gap-2">
          <span className="icon-circle size-9">
            <Mark className="size-6" />
          </span>
          <span className="font-display text-2xl tracking-tight">Turf.</span>
        </Link>
        <p className="mt-4 inline-flex h-9 items-center gap-2 self-start rounded-full border border-white/10 px-3 text-xs">
          <span className={cn("size-1.5 rounded-full", demo ? "bg-[#e2c27a]" : "bg-[#7dcea0]")} aria-hidden="true" />
          {demo ? "Demonstração" : "Cartão real"}
        </p>
        <nav className="mt-6 flex flex-col gap-1" aria-label="Principal">
          {NAV.map((item) => {
            const active = isActive(path, item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-[1.125rem] px-3 text-sm",
                  active ? "bg-white/8 text-fg" : "text-muted hover:text-fg",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <nav className="mt-6 flex flex-col gap-1" aria-label="Mais secções">
          {MORE.map((item) => (
            <Link key={item.to} to={item.to} className="flex h-11 items-center rounded-xl px-3 text-sm text-muted hover:text-fg">
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="mt-auto px-1 text-xs leading-relaxed text-subtle">Horas em Dublin. 18+. Não é conselho de aposta.</p>
        <div className="mt-3 px-1">
          <UserButton />
        </div>
      </aside>

      <div className="md:pl-60">
        <main id="conteudo" className="mx-auto w-full max-w-3xl px-4 pt-4 pb-28 md:pt-8 md:pb-16">
          <header className="mb-5 flex items-center justify-between md:hidden">
            <Link to="/" className="flex items-center gap-2" aria-label="Turf, cartão de hoje">
              <span className="icon-circle size-9">
                <Mark className="size-5" />
              </span>
              <span className="font-display text-3xl tracking-tight">Turf.</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 px-3 text-xs">
                <span className={cn("size-1.5 rounded-full", demo ? "bg-[#e2c27a]" : "bg-[#7dcea0]")} aria-hidden="true" />
                {demo ? "Demonstração" : "Cartão real"}
              </span>
              <UserButton />
            </div>
          </header>
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0c0e0c]/95 pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Principal">
        <ul className="grid grid-cols-4">
          {NAV.map((item) => {
            const active = isActive(path, item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 text-xs",
                    active ? "text-[#d7efe4]" : "text-muted",
                  )}
                >
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
