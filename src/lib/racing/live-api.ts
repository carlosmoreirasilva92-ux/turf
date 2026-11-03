import { createServerFn } from "@tanstack/react-start";
import { fetchBetfairOverlay } from "./betfair.server.ts";
import { fetchLiveBoard, fetchLiveDay, fetchLiveRace } from "./live-source.ts";

export const liveDay = createServerFn({ method: "GET" }).handler(async () => fetchLiveDay());

export const liveBoard = createServerFn({ method: "GET" }).handler(async () => fetchLiveBoard());

export const betfairOverlay = createServerFn({ method: "GET" }).handler(async () => fetchBetfairOverlay());

export const liveRace = createServerFn({ method: "POST" })
  .validator((data: { id?: string }) => {
    if (!data?.id || !/^\d{1,12}$/.test(data.id)) throw new Error("Corrida inválida.");
    return { id: data.id };
  })
  .handler(async ({ data }) => fetchLiveRace(data.id));
