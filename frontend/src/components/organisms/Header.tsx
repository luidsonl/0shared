import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../atoms/Button";
import SearchBar from "../molecules/SearchBar";
import UploadWindow from "../molecules/UploadWindow";
import UserMenu from "../molecules/UserMenu";
import { useAuth } from "../../context/useAuth";

export default function Header() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [uploadOpen, setUploadOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <div className="menu-bar">
      <Link className="menu-item brand" to="/">
        0shared
      </Link>
      <Link className="menu-item" to="/">
        Home
      </Link>
      <Link className="menu-item" to="/search">
        Search
      </Link>
      <div className="toolbar-right">
        <SearchBar />
        {token ? (
          user ? (
            <UserMenu
              username={user.username}
              userId={user.userId}
              onUpload={() => setUploadOpen(true)}
              onLogout={handleLogout}
            />
          ) : (
            <Button onClick={handleLogout}>Log out</Button>
          )
        ) : (
          <>
            <Link className="menu-item" to="/login">
              Log in
            </Link>
            <Link className="menu-item" to="/signup">
              Sign up
            </Link>
          </>
        )}
      </div>
      {uploadOpen && (
        <UploadWindow
          onClose={() => setUploadOpen(false)}
          onUploaded={() => setUploadOpen(false)}
        />
      )}
    </div>
  );
}
