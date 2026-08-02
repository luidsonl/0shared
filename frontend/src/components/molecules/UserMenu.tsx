import { Link } from "react-router-dom";
import Button from "../atoms/Button";

interface UserMenuProps {
  username: string;
  userId: string;
  onUpload: () => void;
  onLogout: () => void;
}

export default function UserMenu({ username, userId, onUpload, onLogout }: UserMenuProps) {
  return (
    <>
      <Button onClick={onUpload}>Upload</Button>
      <Link className="menu-item" to={`/users/${encodeURIComponent(userId)}`}>
        {username}
      </Link>
      <Button onClick={onLogout}>Log out</Button>
    </>
  );
}
