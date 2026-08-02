import { Outlet } from "react-router-dom";
import TitleBar from "../atoms/TitleBar";
import Header from "../organisms/Header";

export default function AppLayout() {
  return (
    <div className="app-window window">
      <TitleBar title="0shared" />
      <Header />
      <main className="app-body sunken-panel">
        <Outlet />
      </main>
      <div className="status-bar">
        <div className="status-bar-field">Ready</div>
      </div>
    </div>
  );
}
