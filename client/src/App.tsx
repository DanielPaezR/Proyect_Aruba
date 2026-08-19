import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HomeRedirect } from "./components/HomeRedirect";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { AgendaPage } from "./pages/AgendaPage";
import { ClientDetailPage } from "./pages/ClientDetailPage";
import { ClientsListPage } from "./pages/ClientsListPage";
import { EvidencesReviewPage } from "./pages/EvidencesReviewPage";
import { InventoryPage } from "./pages/InventoryPage";
import { InvoicesQueuePage } from "./pages/InvoicesQueuePage";
import { LoginPage } from "./pages/LoginPage";
import { MaterialRequestsPage } from "./pages/MaterialRequestsPage";
import { MyActivitiesPage } from "./pages/MyActivitiesPage";
import { MyHoursPage } from "./pages/MyHoursPage";
import { MyToolsPage } from "./pages/MyToolsPage";
import { PermissionsPage } from "./pages/PermissionsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ProjectChatPage } from "./pages/ProjectChatPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { ProjectsListPage } from "./pages/ProjectsListPage";
import { RequestMaterialsPage } from "./pages/RequestMaterialsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SupervisorDashboardPage } from "./pages/SupervisorDashboardPage";
import { TeamMapPage } from "./pages/TeamMapPage";
import { ToolAssignmentsPage } from "./pages/ToolAssignmentsPage";
import { ToolIncidentsPage } from "./pages/ToolIncidentsPage";
import { UsersManagementPage } from "./pages/UsersManagementPage";
import { WorkerProfilePage } from "./pages/WorkerProfilePage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<Layout />}>
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/dashboard" element={<SupervisorDashboardPage />} />
              <Route path="/my-activities" element={<MyActivitiesPage />} />
              <Route path="/my-hours" element={<MyHoursPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/projects" element={<ProjectsListPage />} />
              <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
              <Route path="/projects/:projectId/chat" element={<ProjectChatPage />} />
              <Route path="/clients" element={<ClientsListPage />} />
              <Route path="/clients/:clientId" element={<ClientDetailPage />} />
              <Route path="/evidences" element={<EvidencesReviewPage />} />
              <Route path="/invoices" element={<InvoicesQueuePage />} />
              <Route path="/users" element={<UsersManagementPage />} />
              <Route path="/users/:userId" element={<WorkerProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/team-map" element={<TeamMapPage />} />
              <Route path="/agenda" element={<AgendaPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/material-requests" element={<MaterialRequestsPage />} />
              <Route path="/tool-assignments" element={<ToolAssignmentsPage />} />
              <Route path="/tool-incidents" element={<ToolIncidentsPage />} />
              <Route path="/my-tools" element={<MyToolsPage />} />
              <Route path="/request-materials" element={<RequestMaterialsPage />} />
              <Route path="/permissions" element={<PermissionsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
