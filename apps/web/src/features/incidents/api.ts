import type { Schemas } from "@neirapp/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { unwrap } from "../../lib/errors";
import type { IncidentStatus } from "./types";

export function useReportIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Schemas["ReportIncidentRequest"]) =>
      unwrap(await api.POST("/api/v1/incidents", { body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["my-incidents"] }),
  });
}

export function useMyIncidents() {
  return useQuery({
    queryKey: ["my-incidents"],
    queryFn: async () => unwrap(await api.GET("/api/v1/incidents/mine")),
  });
}

export function useIncidents(status?: IncidentStatus) {
  return useQuery({
    queryKey: ["incidents", status],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/incidents", { params: { query: { status } } })),
  });
}

export function useResolveIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      incidentId,
      status,
      resolutionNote,
    }: {
      incidentId: string;
      status: Extract<IncidentStatus, "resolved" | "dismissed">;
      resolutionNote: string | null;
    }) =>
      unwrap(
        await api.PATCH("/api/v1/incidents/{incident_id}/resolve", {
          params: { path: { incident_id: incidentId } },
          body: { status, resolution_note: resolutionNote },
        }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["incidents"] }),
  });
}
