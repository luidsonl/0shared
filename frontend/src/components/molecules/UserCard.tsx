import { Link } from "react-router-dom";

interface UserCardProps {
  userId: string;
  username: string;
}

export default function UserCard({ userId, username }: UserCardProps) {
  return (
    <div className="sunken-panel" style={{ padding: "10px" }}>
      <strong>{username}</strong>
      <div>
        <Link to={`/users/${encodeURIComponent(userId)}`}>View profile</Link>
      </div>
    </div>
  );
}
