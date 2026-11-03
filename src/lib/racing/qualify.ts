export type ModelValidation = {
  status: "none" | "retrospective" | "prospective-pass";
  note: string;
};

export const EXPERIMENTAL: ModelValidation = {
  status: "none",
  note: "Sem validação temporal. O modelo permanece experimental e não recebe o selo QUALIFICADA.",
};

/** Sample size and rule agreement never qualify a selection. */
export function qualificationAllowed(validation: ModelValidation): boolean {
  return validation.status === "prospective-pass";
}
