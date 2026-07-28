import { AppShell } from './components/AppShell.jsx';
import { AppDataProvider } from './context/AppDataContext.jsx';
import { matchRoute, useHashRoute } from './lib/router.js';
import { CandidateFormPage } from './pages/CandidateFormPage.jsx';
import { CatalogsPage } from './pages/CatalogsPage.jsx';
import { EmployeeDetailPage } from './pages/EmployeeDetailPage.jsx';
import { EmployeeFormPage } from './pages/EmployeeFormPage.jsx';
import { EmployeesPage } from './pages/EmployeesPage.jsx';
import { JobTemplateFormPage } from './pages/JobTemplateFormPage.jsx';
import { MovementsPage } from './pages/MovementsPage.jsx';
import { OverviewPage } from './pages/OverviewPage.jsx';
import { ProbationPage } from './pages/ProbationPage.jsx';
import { RostersPage } from './pages/RostersPage.jsx';
import { SupportPage } from './pages/SupportPage.jsx';

function RouteContent({ path, navigate }) {
  let params = matchRoute(path, '/employees/:id/edit');
  if (params) return <EmployeeFormPage id={params.id} navigate={navigate} />;

  if (path === '/employees/new') return <EmployeeFormPage navigate={navigate} />;

  params = matchRoute(path, '/employees/:id');
  if (params) return <EmployeeDetailPage id={params.id} navigate={navigate} />;

  params = matchRoute(path, '/probation/candidates/:id/edit');
  if (params) return <CandidateFormPage id={params.id} navigate={navigate} />;

  params = matchRoute(path, '/probation/templates/:id/edit');
  if (params) return <JobTemplateFormPage id={params.id} navigate={navigate} />;

  if (path === '/probation/candidates/new') return <CandidateFormPage navigate={navigate} />;
  if (path === '/probation/templates/new') return <JobTemplateFormPage navigate={navigate} />;
  if (path === '/probation/templates') return <ProbationPage navigate={navigate} activeTab="templates" />;
  if (path === '/probation') return <ProbationPage navigate={navigate} />;

  if (path === '/employees') return <EmployeesPage navigate={navigate} />;
  if (path === '/overview') return <OverviewPage navigate={navigate} />;
  if (path === '/movements') return <MovementsPage navigate={navigate} />;
  if (path === '/rosters') return <RostersPage />;
  if (path === '/catalogs') return <CatalogsPage />;
  if (path === '/notifications') return <SupportPage type="notifications" />;
  if (path === '/imports') return <SupportPage type="imports" />;
  if (path === '/audit') return <SupportPage type="audit" />;

  return <OverviewPage navigate={navigate} />;
}

function RoutedApp() {
  const { path, navigate } = useHashRoute();
  return (
    <AppShell path={path} navigate={navigate}>
      <RouteContent path={path} navigate={navigate} />
    </AppShell>
  );
}

export default function App() {
  return (
    <AppDataProvider>
      <RoutedApp />
    </AppDataProvider>
  );
}
