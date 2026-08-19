export interface WorkerDocument {
  id: string;
  userId: string;
  label: string;
  fileUrl: string;
  filePublicId: string;
  uploadedById: string;
  uploadedBy: { id: string; name: string };
  createdAt: string;
}
