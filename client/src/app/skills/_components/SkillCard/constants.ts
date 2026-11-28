import type { IconName } from "@devdigest/ui";
import type { SkillSource } from "@devdigest/shared";

/** Source badge icon (label is i18n'd under `skills.source.*`). */
export const SOURCE_ICON: Record<SkillSource, IconName> = {
  manual: "Edit",
  extracted: "Layers",
  community: "Users",
  imported_url: "Upload",
};
