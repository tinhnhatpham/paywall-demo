import { createClient } from "@supabase/supabase-js";

// The publishable key is meant to be public. What protects the data is Row Level Security in the
// database: this key alone can read nothing but the signed-in user's own rows.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

export const ACTIVE_STATUSES = ["active", "trialing"];

/** POST to our Flask backend as the signed-in user. Returns the JSON body or throws. */
export async function callApi(path, session) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    throw new Error("Can't reach the server. The free demo server may be waking up: try again in a minute.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

/** Send the user to Stripe Checkout (or the Billing Portal). */
export async function goToStripe(path, session) {
  const { url } = await callApi(path, session);
  window.location.assign(url);
}

export function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "";
}
