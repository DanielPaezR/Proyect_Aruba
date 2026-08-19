import { useTranslation } from "react-i18next";
import { ChatPanel } from "./ChatPanel";

interface ProjectChatSectionProps {
  projectId: string;
}

/** Seccion de chat en ProjectDetailPage (Jefe/Supervisor) — mismo patron de
 * seccion apilada que ProjectInvoicesSection/ProjectPaymentsSection. */
export function ProjectChatSection({ projectId }: ProjectChatSectionProps) {
  const { t } = useTranslation("chat");

  return (
    <section className="project-chat-section">
      <div className="page-header">
        <h2 className="section-label">{t("sectionTitle")}</h2>
      </div>
      <ChatPanel projectId={projectId} />
    </section>
  );
}
