import { useTranslation } from "react-i18next";
import { EvidenceReviewItem } from "./EvidenceReviewItem";
import type { EvidenceWithActivity } from "../types/evidence";

interface EvidenceReviewGroupProps {
  activity: EvidenceWithActivity["activity"];
  evidences: EvidenceWithActivity[];
  onReviewed: (evidence: EvidenceWithActivity) => void;
}

/** Una tarjeta por actividad, con todas sus evidencias agrupadas debajo — asi
 * el supervisor entiende de un vistazo que trabajo esta revisando, en vez de
 * una lista plana mezclando actividades distintas. */
export function EvidenceReviewGroup({ activity, evidences, onReviewed }: EvidenceReviewGroupProps) {
  const { t } = useTranslation(["evidences"]);

  const pendingCount = evidences.filter((evidence) => evidence.status === "PENDIENTE").length;

  return (
    <li className="card">
      <div className="card-header">
        <span className="card-title">{activity.title}</span>
        {pendingCount > 0 && (
          <span className="status-badge">{t("pendingCount", { ns: "evidences", count: pendingCount })}</span>
        )}
      </div>
      <span className="card-meta">{activity.project.name}</span>

      <div className="evidence-review-list">
        {evidences.map((evidence) => (
          <EvidenceReviewItem key={evidence.id} evidence={evidence} onReviewed={onReviewed} />
        ))}
      </div>
    </li>
  );
}
