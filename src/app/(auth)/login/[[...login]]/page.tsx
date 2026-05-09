import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CustomSignInForm } from "@/components/auth/CustomSignInForm";
import { AnimatedLogo } from "@/components/auth/AnimatedLogo";
import { AuthBackground } from "@/components/auth/AuthShellAnimations";

/**
 * Sign-in page. Mirror of /register but for returning users.
 * Replaces Clerk's hosted <SignIn /> embed with our own
 * <CustomSignInForm /> — Clerk still handles the auth backend
 * via the useSignIn() hook, only the UI shell is ours.
 *
 * Light theme to match /register. Same `?redirect=` sanitized
 * query param — anonymous-CTA flows can route the user back to
 * a specific path (e.g. /checkout) after login.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  // Sanitize the redirect: only same-origin paths starting with "/"
  // are accepted. Prevents an open-redirect XSS where someone could
  // craft /login?redirect=//evil.com and bounce a logged-in user
  // off our domain. Must be a path, not an absolute URL.
  const params = await searchParams;
  const rawRedirect = params?.redirect;
  const safeRedirect =
    typeof rawRedirect === "string" && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/editor";

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 relative overflow-hidden">
      {/* Floating ambient blobs — depth without distraction */}
      <AuthBackground />

      {/* Top Header — back arrow + animated logo */}
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

      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8 z-10">
        <CustomSignInForm redirectAfter={safeRedirect} />
      </div>
    </div>
  );
}
