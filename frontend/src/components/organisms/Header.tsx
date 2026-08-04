import { useNavigate } from "react-router-dom";
import { Link, NavLink } from "react-router-dom";
import Button from "../atoms/Button";
import SearchBar from "../molecules/SearchBar";
import UploadButton from "./UploadButton";
import UserMenu from "../molecules/UserMenu";
import { Logo, Wordmark } from "../brand/Logo";
import { useAuth } from "../../context/useAuth";
import { cn } from "../../lib/utils";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "px-2 py-1 text-[11px] font-semibold uppercase tracking-widest transition-colors",
    isActive ? "text-accent" : "text-muted hover:text-foreground",
  );

export default function Header() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-foreground hover:no-underline">
          <Logo className="h-7 w-7 text-foreground" />
          <Wordmark className="text-base" />
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
          <NavLink to="/search" className={navLinkClass}>
            Search
          </NavLink>
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <SearchBar />
          {token ? (
            user ? (
              <>
                <UploadButton size="sm" />
                <UserMenu
                  username={user.username}
                  userId={user.userId}
                  onLogout={handleLogout}
                />
              </>
            ) : (
              <Button onClick={handleLogout} variant="ghost" size="sm">
                Log out
              </Button>
            )
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Log in
                </Button>
              </Link>
              <Link to="/signup">
                <Button variant="primary" size="sm">
                  Sign up
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
