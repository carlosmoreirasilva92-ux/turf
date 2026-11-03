import { createServerFn } from "@tanstack/react-start";
import { fetchLiveDay, fetchLiveRace } from "./live-source.ts";

export const liveDay = createServerFn({ method: "GET" }).handler(async () => fetchLiveDay());

export const liveRace = createServerFn({ method: "POST" })
  .validator((data: { id?: string }) => {
    if (!data?.id || !/^\d{1,12}$/.test(data.id)) throw new Error("Corrida inválida.");
    return { id: data.id };
  })
  .handler(async ({ data }) => fetchLiveRace(data.id));
