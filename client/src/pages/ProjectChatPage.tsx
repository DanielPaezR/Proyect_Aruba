import { useTranslation } from "react-i18next";
import { useLocation, useParams } from "react-router-dom";
import { ChatPanel } from "../components/ChatPanel";
import { PageHeader } from "../components/PageHeader";

interface ProjectChatLocationState {
  projectName?: string;
}

/**
 * Vista simple de chat para el Trabajador de Campo, a la que se llega desde
 * el boton "Chat del proyecto" de MyActivityCard — a diferencia de
 * ProjectDetailPage (que el Trabajador de Campo no puede ver), esta pantalla
 * no expone nada mas del proyecto que el chat en si.
 */
export function ProjectChatPage() {
  const { t } = useTranslation("chat");
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const projectName = (location.state as ProjectChatLocationState | null)?.projectName;

  if (!projectId) {
    return null;
  }

  return (
    <div className="project-chat-page">
      <PageHeader title={projectName ? t("pageTitleWithProject", { name: projectName }) : t("pageTitle")} back={{}} />
      <ChatPanel projectId={projectId} />
    </div>
  );
}
