import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { isRegistrationOpen } from "@/lib/flags";
import { MaintenanceView } from "@/components/MaintenanceView";
import { CustomAuthForm } from "@/components/auth/CustomAuthForm";
import { AnimatedLogo } from "@/components/auth/AnimatedLogo";
import { AuthBackground } from "@/components/auth/AuthShellAnimations";

/**
 * Sign-up page. Renders our own <CustomSignUpForm /> instead of Clerk's
 * hosted <SignUp /> embed. Clerk still handles the auth backend (sessions,
 * password hashing) via the useSignUp() hook inside the form — only the
 * UI shell is ours.
 *
 * Why custom: Clerk's hosted modal had three compounding conversion
 * killers — slow iframe, unstyled fallback CSS on old Android, and the
 * "Creaive Ai" typo'd app name in the modal header. Yandex WebVisor
 * showed 0/50 visitors completing the modal flow.
 *
 * The form lives entirely in our DOM with our styles. No iframe, no
 * brand-name typo, no carrier-dependent SMS step.
 *
 * Supports `?redirect=` query param so flows like pricing-CTA can
 * route users back to /checkout after registration. Defaults to
 * /onboarding for the welcome+instructions screen.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  if (!isRegistrationOpen()) return <MaintenanceView />;

  // Sanitize the redirect: only same-origin paths starting with "/"
  // are accepted. Prevents an open-redirect XSS where someone could
  // craft /register?redirect=//evil.com and bounce a registered user
  // off our domain. Must be a path, not an absolute URL.
  const params = await searchParams;
  const rawRedirect = params?.redirect;
  const safeRedirect =
    typeof rawRedirect === "string" && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/onboarding";

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 relative overflow-hidden">
      {/* Floating ambient blobs — depth without distraction.
          Animated gentle drift via framer-motion, pointer-events-none. */}
      <AuthBackground />

      {/* Top Header — back-to-home + animated brand mark */}
      <div className="px-6 py-5 flex items-center justify-between z-10 w-full max-w-md mx-auto">
        <Link
          href="/"
          className="w-10 h-10 bg-white border border-neutral-200 rounded-full flex items-center justify-center text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-all shadow-sm"
          aria-label="На главную"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <AnimatedLogo size="sm" />
        <div className="w-10" /> {/* Spacer to keep logo centered */}
      </div>

      {/* Form fills the rest of the viewport. flex-1 + items-center keeps
          the card vertically centered on tall screens; on short mobile
          screens (< form height) the form becomes scrollable naturally
          via the parent's column flow. */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8 z-10">
        <CustomAuthForm defaultMode="register" redirectAfter={safeRedirect} />
      </div>
    </div>
  );
}
