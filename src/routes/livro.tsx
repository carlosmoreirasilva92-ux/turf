import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/livro")({ component: LivroLayout });

function LivroLayout() {
  return <Outlet />;
}
