import { Link } from "react-router-dom";
import Avatar from "../atoms/Avatar";
import Card, { CardBody } from "../atoms/Card";

interface UserCardProps {
  userId: string;
  username: string;
}

export default function UserCard({ userId, username }: UserCardProps) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <Avatar username={username} className="h-9 w-9 text-sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{username}</p>
          <Link to={`/users/${encodeURIComponent(userId)}`} className="text-xs text-accent">
            View profile
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
