import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** Landing por rol: el trabajador de campo no tiene acceso al panel del supervisor. */
export function HomeRedirect() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return <Navigate to={user.role === "TRABAJADOR_CAMPO" ? "/my-activities" : "/dashboard"} replace />;
}
