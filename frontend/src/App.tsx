import { Navigate, Route, Routes } from "react-router-dom";

import { Shell } from "./components/common/Shell";
import { AgentsPage } from "./pages/AgentsPage";
import { CaseIntakePage } from "./pages/CaseIntakePage";
import { CaseQueuePage } from "./pages/CaseQueuePage";
import { CaseTheatrePage } from "./pages/CaseTheatrePage";
import { EscalationsPage } from "./pages/EscalationsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PortfolioPage } from "./pages/PortfolioPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/queue" element={<CaseQueuePage />} />
        <Route path="/intake" element={<CaseIntakePage />} />
        <Route path="/cases/:id" element={<CaseTheatrePage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/escalations" element={<EscalationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
