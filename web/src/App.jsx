import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { ACTIVE_STATUSES, supabase } from "./lib.js";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Members from "./pages/Members.jsx";
import Account from "./pages/Account.jsx";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [membership, setMembership] = useState(null); // the user's subscriptions row, or null

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // RLS lets a user read only their own row, so no user filter is needed here
  const refreshMembership = useCallback(async () => {
    if (!session) return setMembership(null);
    const { data } = await supabase
      .from("subscriptions")
      .select("status, current_period_end, cancel_at_period_end")
      .maybeSingle();
    setMembership(data);
    return data;
  }, [session]);

  useEffect(() => {
    refreshMembership();
  }, [refreshMembership]);

  const isActive = ACTIVE_STATUSES.includes(membership?.status);
  const shared = { session, membership, isActive, refreshMembership };

  return (
    <>
      <div className="demo-banner">
        Demo in Stripe test mode: no real charges. Pay with card <code>4242 4242 4242 4242</code>, any future
        date, any CVC.
      </div>
      <header className="nav">
        <div className="wrap nav-inner">
          <Link to="/" className="brand">
            Riverside <span>Yoga</span>
          </Link>
          <nav>
            <NavLink to="/members">Members</NavLink>
            {session ? <NavLink to="/account">Account</NavLink> : <NavLink to="/login">Log in</NavLink>}
          </nav>
        </div>
      </header>
      <main className="wrap">
        {session === undefined ? (
          <p className="muted center">Loading…</p>
        ) : (
          <Routes>
            <Route path="/" element={<Home {...shared} />} />
            <Route path="/login" element={<Login {...shared} />} />
            <Route path="/members" element={<Members {...shared} />} />
            <Route path="/account" element={<Account {...shared} />} />
            <Route path="*" element={<p className="center">Page not found. <Link to="/">Go home</Link></p>} />
          </Routes>
        )}
      </main>
      <footer className="wrap muted">Riverside Yoga is fictional. This site demonstrates a Stripe + Supabase membership paywall.</footer>
    </>
  );
}
