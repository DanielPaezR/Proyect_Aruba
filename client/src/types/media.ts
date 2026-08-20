export const MEDIA_TYPES = ["IMAGEN", "VIDEO"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];
