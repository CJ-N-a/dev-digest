export const DIFF_MODAL_WIDTH = 860;

/** Gutter sign per diff row kind. */
export const DIFF_SIGN = { add: "+", del: "-", ctx: " " } as const;

/** i18n key (under `skills`) per metadata field. */
export const FIELD_LABEL_KEY = {
  name: "diff.fieldName",
  description: "diff.fieldDescription",
  type: "diff.fieldType",
} as const;
