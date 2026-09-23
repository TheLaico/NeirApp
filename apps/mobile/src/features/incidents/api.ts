import type { Schemas } from "@neirapp/api-client";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

export function useReportIncident() {
  return useMutation({
    mutationFn: async (body: Schemas["ReportIncidentRequest"]) =>
      unwrap(await api.POST("/api/v1/incidents", { body })),
  });
}
