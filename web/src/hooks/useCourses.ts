import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Course } from "../api/types";
import { useLanguage } from "../auth/AuthContext";

export function useCourses() {
    const language = useLanguage();
    return useQuery({
        queryKey: ["courses", language.id],
        queryFn: () => api<Course[]>("/courses", { query: { language_id: language.id } }),
    });
}
