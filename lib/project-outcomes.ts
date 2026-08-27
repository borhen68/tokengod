export const projectOutcomeIds = ["revenue", "pre_revenue", "shut_down"] as const;

export type ProjectOutcome = (typeof projectOutcomeIds)[number];

export const projectOutcomeOptions: Array<{
  id: ProjectOutcome;
  label: string;
  description: string;
}> = [
  { id: "revenue", label: "Made revenue", description: "The product earned money" },
  { id: "pre_revenue", label: "Pre-revenue", description: "Live, but $0 so far" },
  { id: "shut_down", label: "Shut down", description: "An honest failed experiment" },
];

export function normalizeProjectOutcome(value: unknown): ProjectOutcome {
  return value === "pre_revenue" || value === "shut_down" ? value : "revenue";
}

export function projectOutcomeLabel(outcome: ProjectOutcome) {
  if (outcome === "pre_revenue") return "Pre-revenue";
  if (outcome === "shut_down") return "Honest failure";
  return "Made revenue";
}
