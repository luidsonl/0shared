import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../atoms/Button";
import ErrorText from "../atoms/ErrorText";
import Field from "../atoms/Field";
import TextInput from "../atoms/TextInput";
import Window from "../atoms/Window";
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
    <div className="center-col" style={{ width: "100%" }}>
      <Window title="Sign up">
        {done ? (
          <div className="field-row-stacked">
            <p className="success-text">Account created successfully.</p>
            <p>
              You can now <Link to="/login">log in</Link>.
            </p>
          </div>
        ) : (
          <form className="field-row-stacked" onSubmit={handleSubmit}>
            <Field label="Email:" htmlFor="signup-email">
              <TextInput
                id="signup-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Username:" htmlFor="signup-username">
              <TextInput
                id="signup-username"
                required
                minLength={3}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>
            <Field label="Password:" htmlFor="signup-password">
              <TextInput
                id="signup-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && <ErrorText message={error} />}
            <div className="row">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Sign up"}
              </Button>
            </div>
            <p>
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </form>
        )}
      </Window>
    </div>
  );
}
