import type { UserRole } from "./auth";

export interface ChatMessage {
  id: string;
  projectId: string;
  content: string;
  createdAt: string;
  sender: { id: string; name: string; role: UserRole };
}
