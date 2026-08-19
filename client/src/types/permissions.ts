/** Secciones que se pueden habilitar/deshabilitar por persona — un "portón"
 * por seccion, separado de los permisos finos que ya existen dentro de cada
 * una. USUARIOS incluye CRUD de usuarios + mapa de equipo + horas/pago de
 * trabajadores. */
export const FEATURES = ["USUARIOS", "PROYECTOS", "CLIENTES", "INVENTARIO", "EVIDENCIAS", "FACTURAS"] as const;
export type Feature = (typeof FEATURES)[number];

/** Estado efectivo (default por rol + override ya resuelto) de las 6 Feature. */
export type FeaturePermissions = Record<Feature, boolean>;
