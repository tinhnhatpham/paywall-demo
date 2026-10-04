import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { formatDate, goToStripe, supabase } from "../lib.js";

export default function Account({ session, membership, isActive }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!session) return <Navigate to="/login" replace />;

  async function manageBilling() {
    setBusy(true);
    setError("");
    try {
      await goToStripe("/api/portal", session);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  let status = "No membership";
  if (isActive && membership.cancel_at_period_end) status = `Active until ${formatDate(membership.current_period_end)} (cancelled)`;
  else if (isActive) status = `Active, renews ${formatDate(membership.current_period_end)}`;
  else if (membership?.status === "past_due") status = "Payment failed: please update your card";
  else if (membership?.status === "canceled") status = "Cancelled";

  return (
    <section className="card narrow">
      <h1>Your account</h1>
      <dl>
        <dt>Email</dt>
        <dd>{session.user.email}</dd>
        <dt>Membership</dt>
        <dd>{status}</dd>
      </dl>
      {error && <p className="error">{error}</p>}
      <div className="row">
        {membership?.status && membership.status !== "none" ? (
          <button className="btn" onClick={manageBilling} disabled={busy}>
            {busy ? "Opening…" : "Manage billing or cancel"}
          </button>
        ) : (
          <Link className="btn" to="/">See membership</Link>
        )}
        <button className="link" onClick={() => supabase.auth.signOut()}>
          Log out
        </button>
      </div>
    </section>
  );
}
