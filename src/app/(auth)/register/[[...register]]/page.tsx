import { Sparkles, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { isRegistrationOpen } from "@/lib/flags";
import { MaintenanceView } from "@/components/MaintenanceView";
import { CustomSignUpForm } from "@/components/auth/CustomSignUpForm";

/**
 * Sign-up page. Replaced Clerk's hosted <SignUp /> embed with a custom
 * multi-step form (CustomSignUpForm) — Clerk's default modal was slow
 * to load in webviews and broke styling on old Android. The new form
 * lives entirely in our DOM and talks to Clerk via useSignUp() hook.
 *
 * Auth backend is unchanged: Clerk still creates the user, still
 * issues sessions. Only the UI shell is ours.
 *
 * Supports `?redirect=` query param so flows like pricing-CTA can
 * route users back to /checkout after registration. Defaults to
 * /onboarding (welcome screen), which is the standard new-user path.
 */
export default function RegisterPage({
  searchParams,
}: {
  searchParams: { redirect?: string };
}) {
  if (!isRegistrationOpen()) return <MaintenanceView />;

  // Sanitize the redirect: only same-origin paths starting with "/"
  // are accepted. Prevents an open-redirect XSS where someone could
  // craft /register?redirect=//evil.com and bounce a registered user
  // off our domain. Must be a path, not an absolute URL.
  const rawRedirect = searchParams?.redirect;
  const safeRedirect =
    typeof rawRedirect === "string" && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/onboarding";

  return (
    <div className="min-h-screen flex flex-col bg-neutral-900 relative overflow-hidden overscroll-none">
      {/* Background decorations — soft glows that hint at the brand
          orange without dominating the dark canvas. Pointer-events-none
          so they never intercept taps. */}
      <div className="absolute top-[-10%] left-[-20%] w-[500px] h-[500px] bg-hermes-600/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-amber-500/20 rounded-full blur-[100px] pointer-events-none" />

      {/* Top header — back arrow + brand. Mirrors the login page. */}
      <div className="px-6 py-6 pt-12 md:pt-6 flex items-center justify-between z-10 w-full max-w-md mx-auto">
        <Link
          href="/"
          className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/5 rounded-full flex items-center justify-center text-white/80 hover:bg-white/20 hover:text-white transition-all"
          aria-label="Назад на главную"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-hermes-500 flex items-center justify-center shadow-lg shadow-hermes-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-xl text-white tracking-tight">AICreative</span>
        </div>
        <div className="w-10" /> {/* spacer for visual centering */}
      </div>

      <div className="flex-1 flex flex-col justify-center z-10 w-full py-8">
        <CustomSignUpForm redirectUrl={safeRedirect} />
      </div>
    </div>
  );
}
