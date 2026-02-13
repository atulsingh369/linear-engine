import { WorkflowStateNode } from "./client";

const COMPLETED_TYPES = new Set(["completed", "canceled"]);

export function findStateByName(
  states: WorkflowStateNode[],
  stateName: string
): WorkflowStateNode | null {
  const needle = stateName.trim().toLowerCase();
  if (!needle) {
    return null;
  }

  return states.find((state) => state.name.toLowerCase() === needle) ?? null;
}

export function getStateNameById(
  states: WorkflowStateNode[],
  stateId: string | null | undefined
): string {
  if (!stateId) {
    return "Unknown";
  }

  return states.find((state) => state.id === stateId)?.name ?? "Unknown";
}

export function getFirstActiveState(states: WorkflowStateNode[]): WorkflowStateNode | null {
  if (states.length === 0) {
    return null;
  }

  const sorted = [...states].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const started = sorted.filter((state) => (state.type ?? "").toLowerCase() === "started");
  if (started.length > 0) {
    return started[0];
  }

  const activeByName = sorted.find((state) =>
    /in progress|doing|active|started/i.test(state.name)
  );
  if (activeByName) {
    return activeByName;
  }

  return (
    sorted.find((state) => !COMPLETED_TYPES.has((state.type ?? "").toLowerCase())) ?? null
  );
}
