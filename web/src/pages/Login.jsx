import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib.js";

export default function Login({ session }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const isSignup = params.get("mode") === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  if (session) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage({ type: "", text: "" });
    const { data, error } = isSignup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMessage({ type: "error", text: error.message });
    if (isSignup && !data.session) {
      // Email confirmation is switched on in Supabase: no session until they click the link
      return setMessage({ type: "ok", text: "Check your email for a confirmation link, then log in." });
    }
    navigate("/");
  }

  return (
    <section className="card narrow">
      <h1>{isSignup ? "Create your account" : "Log in"}</h1>
      <form onSubmit={submit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={isSignup ? "new-password" : "current-password"}
          />
        </label>
        {message.text && <p className={message.type}>{message.text}</p>}
        <button className="btn" disabled={busy}>
          {busy ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
        </button>
      </form>
      <p className="muted">
        {isSignup ? "Already have an account? " : "New here? "}
        <button className="link" onClick={() => setParams(isSignup ? {} : { mode: "signup" })}>
          {isSignup ? "Log in" : "Create an account"}
        </button>
      </p>
    </section>
  );
}
