import { Outlet } from "react-router-dom";
import Header from "../organisms/Header";
import Toaster from "../atoms/Toaster";

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-[11px] uppercase tracking-widest text-muted">
          <span>
            <span className="text-accent">0</span>shared — share files, zero hassle.
          </span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
      <Toaster />
    </div>
  );
}
