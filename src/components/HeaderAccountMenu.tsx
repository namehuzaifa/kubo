import { Link, useNavigate } from "@tanstack/react-router";
import { FileText, Heart, LogIn, LogOut, User, UserPlus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAdminSession } from "@/hooks/use-admin-session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The person icon in the header.
 *
 * Signed out it offers sign in and registration; signed in it opens the
 * customer's own area and lets them leave. The session is resolved in the
 * browser, so while that is in flight the icon still opens — it just shows the
 * signed-out choices, which is the safe default.
 */
export function HeaderAccountMenu() {
  const { loading, session } = useAdminSession();
  const navigate = useNavigate();

  const signedIn = !loading && session !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={signedIn ? "Your account" : "Sign in"}
          className="flex size-9 items-center justify-center rounded-full bg-background text-foreground/80 shadow-card transition-colors hover:text-brand"
        >
          <User className="size-4" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {signedIn ? (
          <>
            <DropdownMenuLabel className="truncate font-normal">
              <span className="block text-xs text-muted-foreground">Signed in as</span>
              <span className="block truncate text-sm font-medium">{session.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link to="/account">
                <User className="size-4" />
                My account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/account/inquiries">
                <FileText className="size-4" />
                My inquiries
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/account/saved">
                <Heart className="size-4" />
                Saved vehicles
              </Link>
            </DropdownMenuItem>

            {session.isStaff ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/admin">Staff dashboard</Link>
                </DropdownMenuItem>
              </>
            ) : null}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await supabase.auth.signOut();
                void navigate({ to: "/" });
              }}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel className="font-normal text-muted-foreground">
              An account keeps your quotations and documents together.
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/login" search={{ redirect: "/account" }}>
                <LogIn className="size-4" />
                Sign in
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/login" search={{ redirect: "/account" }}>
                <UserPlus className="size-4" />
                Create an account
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
