import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Language } from "../api/types";

export function useLanguages() {
    return useQuery({
        queryKey: ["languages"],
        queryFn: () => api<Language[]>("/languages"),
        staleTime: Infinity,
    });
}
