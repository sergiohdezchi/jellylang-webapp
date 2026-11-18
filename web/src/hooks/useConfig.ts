import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { AppConfig } from "../api/types";

/** Capacidades del servidor; cambian solo al reiniciarlo, así que se consultan una vez. */
export function useConfig() {
    return useQuery({
        queryKey: ["config"],
        queryFn: () => api<AppConfig>("/config"),
        staleTime: Infinity,
    });
}
