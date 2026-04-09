import { createActor } from "@/backend";
import type { backendInterface } from "@/backend.d";
import { useActor as useCoreActor } from "@caffeineai/core-infrastructure";

export function useActor(): {
  actor: backendInterface | null;
  isFetching: boolean;
} {
  return useCoreActor(createActor) as {
    actor: backendInterface | null;
    isFetching: boolean;
  };
}
