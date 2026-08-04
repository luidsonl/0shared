import EmptyState from "../atoms/EmptyState";
import UserCard from "../molecules/UserCard";

interface UserListProps {
  users: { userId: string; username: string }[];
}

export default function UserList({ users }: UserListProps) {
  if (users.length === 0) return <EmptyState message="No users found." />;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {users.map((user) => (
        <UserCard key={user.userId} userId={user.userId} username={user.username} />
      ))}
    </div>
  );
}
