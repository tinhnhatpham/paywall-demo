import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { goToStripe } from "../lib.js";

export default function Home({ session, isActive }) {
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [slow, setSlow] = useState(false);

  async function subscribe() {
    setBusy(true);
    setError("");
    const slowTimer = setTimeout(() => setSlow(true), 6000);
    try {
      await goToStripe("/api/checkout", session);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
    }
  }

  return (
    <>
      <section className="hero">
        <h1>Practice with us, wherever you are.</h1>
        <p>
          Become a member to unlock weekly class notes, guided routines and the members-only studio schedule. Cancel
          any time.
        </p>
      </section>

      {params.get("checkout") === "cancelled" && <p className="note">Checkout cancelled. You haven't been charged.</p>}

      <section className="card plan">
        <h2>Membership</h2>
        <p className="price">
          $9<span>/month</span>
        </p>
        <ul>
          <li>New guided routine every week</li>
          <li>Members-only studio schedule</li>
          <li>Free Saturday community class</li>
          <li>Cancel any time from your account page</li>
        </ul>

        {error && <p className="error">{error}</p>}
        {slow && <p className="note">The free demo server is waking up. This can take up to a minute.</p>}

        {!session && (
          <Link className="btn" to="/login?mode=signup">
            Sign up to join
          </Link>
        )}
        {session && !isActive && (
          <button className="btn" onClick={subscribe} disabled={busy}>
            {busy ? "Opening checkout…" : "Subscribe for $9/month"}
          </button>
        )}
        {session && isActive && (
          <Link className="btn" to="/members">
            Go to the members area
          </Link>
        )}
      </section>
    </>
  );
}
