import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../atoms/Button";
import ErrorText from "../atoms/ErrorText";
import Field from "../atoms/Field";
import TextInput from "../atoms/TextInput";
import Card, { CardBody, CardFooter } from "../atoms/Card";
import { Logo, Wordmark } from "../brand/Logo";
import { signup } from "../../api";
import { toMessage } from "../../lib/errors";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signup({ email, username, password });
      setDone(true);
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
          <span className="text-[11px] uppercase tracking-widest text-muted">Sign up</span>
        </div>
      </div>
      <Card>
        <CardBody>
          {done ? (
            <div className="space-y-3">
              <p className="text-sm text-success">Account created successfully.</p>
              <p className="text-sm text-muted">
                You can now{" "}
                <Link to="/login" className="text-accent">
                  log in
                </Link>
                .
              </p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Field label="Email" htmlFor="signup-email">
                <TextInput
                  id="signup-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Username" htmlFor="signup-username">
                <TextInput
                  id="signup-username"
                  required
                  minLength={3}
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </Field>
              <Field label="Password" htmlFor="signup-password" hint="Minimum 8 characters.">
                <TextInput
                  id="signup-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              {error && <ErrorText message={error} />}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Creating..." : "Sign up"}
              </Button>
            </form>
          )}
        </CardBody>
        {!done && (
          <CardFooter>
            <p className="text-center text-xs text-muted">
              Already have an account?{" "}
              <Link to="/login" className="text-accent">
                Log in
              </Link>
            </p>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
