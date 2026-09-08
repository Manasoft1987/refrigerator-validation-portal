import {
  DEFAULT_IQ_QUESTIONS_WAREHOUSE,
  DEFAULT_OQ_QUESTIONS_WAREHOUSE,
} from "../shared/validation";

type EquipmentRow = { kind?: string | null; name?: string | null };

/**
 * Returns the fixed IQ/OQ checklist for storage-room protocols.
 *
 * The equipment argument is kept for API compatibility with already wired
 * callers, but the storage-room checklist is intentionally no longer expanded
 * by equipment kind: existing and new protocols must use the same reviewed
 * question set.
 */
export function buildWarehouseQuestions(
  _equipment: EquipmentRow[],
  stage: "iq" | "oq",
): string[] {
  return stage === "iq"
    ? [...DEFAULT_IQ_QUESTIONS_WAREHOUSE]
    : [...DEFAULT_OQ_QUESTIONS_WAREHOUSE];
}
