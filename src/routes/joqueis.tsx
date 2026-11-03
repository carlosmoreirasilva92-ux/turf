import { createFileRoute } from "@tanstack/react-router";
import { People } from "@/components/people";

export const Route = createFileRoute("/joqueis")({ component: () => <People kind="jockey" title="Jóqueis" /> });
