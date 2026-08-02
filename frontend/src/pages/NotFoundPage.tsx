import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="center-col" style={{ width: "100%" }}>
      <h2 className="page-title">Page not found</h2>
      <p className="muted-text">The page you are looking for does not exist.</p>
      <Link to="/">Go home</Link>
    </div>
  );
}
