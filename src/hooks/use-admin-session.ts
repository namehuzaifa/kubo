import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getAdminSession, type AdminSession } from "@/lib/admin.functions";

type State = {
  loading: boolean;
  session: AdminSession | null;
};

/**
 * Resolves the caller's role for the dashboard and the customer portal.
 *
 * The Supabase session lives in browser storage, so the server cannot see it
 * during SSR. The check therefore runs on the client after hydration, and
 * `loading` stays true until it settles — guards must wait for it rather than
 * treating the initial null as "signed out", or they bounce real users to the
 * login page on every hard refresh.
 */
export function useAdminSession(): State {
  const [state, setState] = useState<State>({ loading: true, session: null });

  useEffect(() => {
    let active = true;

    async function resolve() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (active) setState({ loading: false, session: null });
        return;
      }
      const { session } = await getAdminSession();
      if (active) setState({ loading: false, session });
    }

    void resolve();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void resolve();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return state;
}
