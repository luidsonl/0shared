import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "../atoms/Button";
import ErrorText from "../atoms/ErrorText";
import Field from "../atoms/Field";
import TextInput from "../atoms/TextInput";
import Window from "../atoms/Window";
import { useAuth } from "../../context/useAuth";
import { toMessage } from "../../lib/errors";

export default function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(toMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="center-col" style={{ width: "100%" }}>
      <Window title="Log in">
        <form className="field-row-stacked" onSubmit={handleSubmit}>
          <Field label="Email:" htmlFor="login-email">
            <TextInput
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password:" htmlFor="login-password">
            <TextInput
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <ErrorText message={error} />}
          <div className="row">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Logging in..." : "Log in"}
            </Button>
          </div>
          <p>
            No account? <Link to="/signup">Sign up</Link>
          </p>
        </form>
      </Window>
    </div>
  );
}
