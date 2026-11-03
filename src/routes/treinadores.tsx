import { createFileRoute } from "@tanstack/react-router";
import { People } from "@/components/people";

export const Route = createFileRoute("/treinadores")({ component: () => <People kind="trainer" title="Treinadores" /> });
