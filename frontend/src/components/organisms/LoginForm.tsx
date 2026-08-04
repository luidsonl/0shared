import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "../atoms/Button";
import ErrorText from "../atoms/ErrorText";
import Field from "../atoms/Field";
import TextInput from "../atoms/TextInput";
import Card, { CardBody, CardFooter } from "../atoms/Card";
import { Logo, Wordmark } from "../brand/Logo";
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
    <div className="mx-auto flex w-full max-w-sm flex-col">
      <div className="mb-8 flex items-center justify-center gap-3">
        <Logo className="h-9 w-9 text-foreground" />
        <div>
          <Wordmark className="block text-lg" />
          <span className="text-[11px] uppercase tracking-widest text-muted">Log in</span>
        </div>
      </div>
      <Card>
        <CardBody>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field label="Email" htmlFor="login-email">
              <TextInput
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password" htmlFor="login-password">
              <TextInput
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && <ErrorText message={error} />}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Logging in..." : "Log in"}
            </Button>
          </form>
        </CardBody>
        <CardFooter>
          <p className="text-center text-xs text-muted">
            No account?{" "}
            <Link to="/signup" className="text-accent">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
