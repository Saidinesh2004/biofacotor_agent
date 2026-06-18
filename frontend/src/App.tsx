import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Farmers from "./pages/Farmers";
import Campaigns from "./pages/Campaigns";
import Responses from "./pages/Responses";
import Reports from "./pages/Reports";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="farmers" element={<Farmers />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="responses" element={<Responses />} />
          <Route path="reports" element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
