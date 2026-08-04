import { Link } from "react-router-dom";
import Button from "../components/atoms/Button";
import { Logo } from "../components/brand/Logo";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Logo className="h-16 w-16 text-muted" />
      <p className="mt-6 text-5xl font-bold tracking-tight">
        <span className="text-accent">4</span>
        <span className="text-primary">0</span>
        <span className="text-accent">4</span>
      </p>
      <p className="mt-3 text-sm text-muted">
        The page you are looking for does not exist.
      </p>
      <Link to="/" className="mt-6">
        <Button variant="secondary">Go home</Button>
      </Link>
    </div>
  );
}
