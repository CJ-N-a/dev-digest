import { ApiError } from "@/lib/api";

/** POST/PATCH rejected because another skill in the workspace has this name. */
export function isNameTaken(e: unknown): boolean {
  return e instanceof ApiError && (e.code === "skill_name_taken" || e.status === 409);
}
