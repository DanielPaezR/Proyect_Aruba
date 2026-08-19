import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function landingFor(role: string): string {
  if (role === "TRABAJADOR_CAMPO") {
    return "/my-activities";
  }
  if (role === "MERCADERISTA") {
    return "/inventory";
  }
  return "/dashboard";
}

/** Landing por rol: cada rol cae en la pantalla a la que sí tiene acceso
 * (el trabajador de campo no tiene panel de supervisor, el mercaderista no
 * tiene dashboard ni panel de supervisor). */
export function HomeRedirect() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return <Navigate to={landingFor(user.role)} replace />;
}
