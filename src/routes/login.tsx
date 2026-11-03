import { createFileRoute } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <div className="mx-auto max-w-sm pt-10">
      <h1 className="font-display text-4xl tracking-tight">Entrar</h1>
      <p className="mt-2 text-sm text-muted">
        O livro real fica ligado à tua sessão. A demonstração continua visível sem conta e não é copiada.
      </p>
      <div className="mt-6 space-y-2">
        {authEnabled ? (
          GROK_PROVIDERS.map((provider) => (
            <button
              key={provider.providerId}
              type="button"
              onClick={() => signIn(provider.providerId, { callbackURL: "/livro" })}
              className="chip-holo h-11 w-full rounded-full text-sm"
            >
              Continuar com {provider.label}
            </button>
          ))
        ) : (
          <p className="text-sm text-muted">A sessão ainda não está ligada neste servidor.</p>
        )}
      </div>
    </div>
  );
}
