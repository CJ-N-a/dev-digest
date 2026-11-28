import { VERSION_DATE_FORMAT } from "./constants";

/** ISO timestamp → short local date (raw string when unparsable). */
export function formatVersionDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, VERSION_DATE_FORMAT);
}
