import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ACTIVE_STATUSES, goToStripe, supabase } from "../lib.js";

export default function Members({ session, isActive, refreshMembership }) {
  const [params] = useSearchParams();
  const justPaid = params.get("checkout") === "success";
  const [posts, setPosts] = useState(null);
  const [waiting, setWaiting] = useState(justPaid && !isActive);
  const [error, setError] = useState("");

  // Right after Stripe Checkout, the webhook may land a few seconds after the redirect: poll briefly
  useEffect(() => {
    if (!justPaid || isActive) return setWaiting(false);
    let tries = 0;
    const timer = setInterval(async () => {
      const row = await refreshMembership();
      tries += 1;
      if (ACTIVE_STATUSES.includes(row?.status) || tries >= 10) {
        clearInterval(timer);
        setWaiting(false);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [justPaid, isActive, refreshMembership]);

  // The database decides what we get back: RLS returns rows only to active members
  useEffect(() => {
    if (!session) return;
    supabase
      .from("premium_content")
      .select("id, title, body")
      .order("sort")
      .then(({ data, error }) => (error ? setError("Couldn't load content.") : setPosts(data)));
  }, [session, isActive]);

  if (!session) {
    return (
      <section className="card narrow center">
        <h1>Members area</h1>
        <p>Log in to see your membership content.</p>
        <Link className="btn" to="/login">Log in</Link>
      </section>
    );
  }

  if (waiting) return <p className="card narrow center">Confirming your payment with Stripe…</p>;

  if (!isActive) {
    return (
      <section className="card narrow center locked">
        <h1>🔒 Members only</h1>
        <p>This content is for members. Join for $9/month and cancel any time.</p>
        {justPaid && <p className="note">We haven't received confirmation from Stripe yet. Refresh in a moment.</p>}
        <button className="btn" onClick={() => goToStripe("/api/checkout", session).catch((e) => setError(e.message))}>
          Subscribe for $9/month
        </button>
        {error && <p className="error">{error}</p>}
      </section>
    );
  }

  return (
    <section>
      {justPaid && <p className="note ok">Welcome! Your membership is active.</p>}
      <h1>This month's classes</h1>
      {error && <p className="error">{error}</p>}
      {posts === null ? (
        <p className="muted">Loading…</p>
      ) : (
        posts.map((p) => (
          <article key={p.id} className="card post">
            <h2>{p.title}</h2>
            <p>{p.body}</p>
          </article>
        ))
      )}
    </section>
  );
}
