export interface WorkerDocument {
  id: string;
  userId: string;
  label: string;
  fileUrl: string;
  filePublicId: string;
  /** Bytes, viene de Cloudinary al subir. Null = documento sembrado antes de esta migracion. */
  fileSize: number | null;
  /** Null = documento sembrado antes de esta migracion — el cliente cae a
   * detectar el tipo (PDF vs imagen) por la extension de fileUrl. */
  mimeType: string | null;
  uploadedById: string;
  uploadedBy: { id: string; name: string };
  createdAt: string;
}
