import { Link, useRouterState } from "@tanstack/react-router";
import { Ellipsis, Library, LayoutList, Ribbon, SunMedium } from "lucide-react";
import type { ReactNode } from "react";
import { Mark } from "@/components/mark";
import { UserButton } from "@/lib/auth/gates";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Hoje", icon: SunMedium },
  { to: "/corridas", label: "Corridas", icon: LayoutList },
  { to: "/cavalos", label: "Cavalos", icon: Ribbon },
  { to: "/livro", label: "Livro", icon: Library },
  { to: "/mais", label: "Mais", icon: Ellipsis },
] as const;

const MORE = [
  { to: "/arquivo", label: "Arquivo" },
  { to: "/joqueis", label: "Jóqueis" },
  { to: "/treinadores", label: "Treinadores" },
  { to: "/fontes", label: "Fontes" },
  { to: "/catalogo", label: "Catálogo" },
  { to: "/caderno", label: "Caderno" },
  { to: "/agentes", label: "Agentes" },
] as const;

function isActive(path: string, to: string) {
  if (to === "/") return path === "/";
  if (to === "/corridas") return path.startsWith("/corridas") || path.startsWith("/corrida");
  if (to === "/cavalos") return path.startsWith("/cavalos") || path.startsWith("/cavalo");
  if (to === "/mais") return ["/mais", "/arquivo", "/joqueis", "/joquei", "/treinadores", "/treinador", "/fontes", "/catalogo", "/caderno", "/agentes"].some((item) => path === item || path.startsWith(`${item}/`));
  return path.startsWith(to);
}

export function Shell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="app-root min-h-dvh text-fg">
      <aside className="glass-nav fixed inset-y-3 left-3 z-20 hidden w-52 flex-col rounded-[1.75rem] px-4 py-6 md:flex">
        <Link to="/" aria-label="TURF, hoje" className="flex items-center gap-2">
          <span className="icon-circle size-9">
            <Mark className="size-6" />
          </span>
          <span className="font-display text-xl tracking-tight">TURF</span>
        </Link>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((item) => {
            const active = isActive(path, item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-[1.125rem] px-3 text-sm transition-colors duration-150",
                  active ? "chip-holo" : "text-muted hover:text-fg",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <nav className="mt-6 flex flex-col gap-1">
          {MORE.map((item) => (
            <Link key={item.to} to={item.to} className="flex h-9 items-center rounded-xl px-3 text-sm text-muted hover:text-fg">
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="mt-auto px-1 text-xs leading-relaxed text-subtle">
          Horas em Dublin. A demonstração não entra no arquivo. 18+.
        </p>
        <div className="mt-3 px-1">
          <UserButton />
        </div>
      </aside>

      <div className="md:pl-60">
        <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-32 md:pt-8 md:pb-16">
          <header className="mb-5 flex items-center justify-between md:hidden">
            <Link to="/" className="flex items-center gap-2" aria-label="TURF, hoje">
              <span className="icon-circle size-8">
                <Mark className="size-5" />
              </span>
              <span className="font-display text-lg tracking-tight">TURF</span>
            </Link>
            <span className="text-xs text-subtle">Dublin</span>
            <UserButton />
          </header>
          {children}
          <p className="mt-6 text-xs leading-relaxed text-subtle">
            A demonstração é fictícia e não migra para o livro.{" "}
            <Link to="/livro" className="text-accent">
              Abrir o livro
            </Link>
            . 18+. Não é conselho de aposta.
          </p>
        </main>
      </div>

      <nav className="glass-nav fixed inset-x-3 bottom-3 z-20 rounded-[1.75rem] pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="grid grid-cols-5">
          {NAV.map((item) => {
            const active = isActive(path, item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-0.5 text-[10px] leading-none",
                    active ? "text-fg" : "text-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full",
                      active && "icon-circle",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
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
