import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Organizations from "./pages/Organizations";
import OrganizationDetail from "./pages/OrganizationDetail";
import ProtocolsIndex from "./pages/ProtocolsIndex";
import Wizard from "./pages/Wizard";
import QuestionTemplates from "./pages/QuestionTemplates";
import AdminCompanies from "./pages/AdminCompanies";
import AdminCompanyDetail from "./pages/AdminCompanyDetail";
import AdminUsers from "./pages/AdminUsers";
import SensorPlacementPage from "./pages/SensorPlacementPage";
import { SensorManagementPage } from "./pages/SensorManagementPage";
function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/organizations" component={Organizations} />
      <Route path="/organizations/:id" component={OrganizationDetail} />
      <Route path="/protocols" component={ProtocolsIndex} />
      <Route path="/protocols/:id" component={Wizard} />
      <Route path="/protocols/:id/sensor-placement" component={SensorPlacementPage} />
      <Route path="/settings/templates" component={QuestionTemplates} />
      <Route path="/sensors" component={SensorManagementPage} />
      <Route path="/admin/companies" component={AdminCompanies} />
      <Route path="/admin/companies/:id" component={AdminCompanyDetail} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-center" />
          <DashboardLayout>
            <Router />
          </DashboardLayout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
