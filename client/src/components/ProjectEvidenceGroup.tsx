import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EvidenceReviewGroup } from "./EvidenceReviewGroup";
import type { EvidenceWithActivity } from "../types/evidence";

export interface ActivityGroup {
  activity: EvidenceWithActivity["activity"];
  evidences: EvidenceWithActivity[];
}

interface ProjectEvidenceGroupProps {
  project: { id: string; name: string };
  activityGroups: ActivityGroup[];
  onReviewed: (evidence: EvidenceWithActivity) => void;
}

/** Una tarjeta por proyecto, colapsable, con sus grupos de actividad (ver
 * EvidenceReviewGroup) adentro — un nivel mas de agrupamiento arriba de
 * actividad, para que el supervisor ubique de un vistazo en que proyecto
 * esta trabajando antes de bajar al detalle. */
export function ProjectEvidenceGroup({ project, activityGroups, onReviewed }: ProjectEvidenceGroupProps) {
  const { t } = useTranslation(["evidences"]);
  const [isOpen, setIsOpen] = useState(true);

  const pendingCount = activityGroups.reduce(
    (sum, group) => sum + group.evidences.filter((evidence) => evidence.status === "PENDIENTE").length,
    0,
  );

  return (
    <li className="card project-evidence-group">
      <button
        type="button"
        className="project-evidence-group__toggle"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
      >
        <span className="card-title">{project.name}</span>
        <span className="project-evidence-group__meta">
          {pendingCount > 0 && (
            <span className="status-badge">{t("pendingCount", { ns: "evidences", count: pendingCount })}</span>
          )}
          <span className="project-evidence-group__chevron">{isOpen ? "▾" : "▸"}</span>
        </span>
      </button>

      {isOpen && (
        <ul className="card-list project-evidence-group__activities">
          {activityGroups.map((group) => (
            <EvidenceReviewGroup
              key={group.activity.id}
              activity={group.activity}
              evidences={group.evidences}
              onReviewed={onReviewed}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
