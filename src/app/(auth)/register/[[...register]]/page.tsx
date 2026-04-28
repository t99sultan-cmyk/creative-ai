import { SignUp } from "@clerk/nextjs";
import { Sparkles, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { isRegistrationOpen } from "@/lib/flags";
import { MaintenanceView } from "@/components/MaintenanceView";

export default function RegisterPage() {
  if (!isRegistrationOpen()) return <MaintenanceView />;

  return (
    <div className="min-h-screen flex flex-col bg-neutral-900 relative overflow-hidden overscroll-none">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-20%] w-[500px] h-[500px] bg-hermes-600/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-amber-500/20 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Top Header */}
      <div className="px-6 py-6 pt-12 md:pt-6 flex items-center justify-between z-10 w-full max-w-md mx-auto">
        <Link href="/" className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/5 rounded-full flex items-center justify-center text-white/80 hover:bg-white/20 hover:text-white transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-hermes-500 flex items-center justify-center shadow-lg shadow-hermes-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-xl text-white tracking-tight">Creative AI</span>
        </div>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      <div className="flex-1 flex flex-col justify-end md:justify-center z-10 w-full mb-0 md:mb-6 max-w-sm mx-auto">
        <div className="w-full text-center px-6 mb-8 md:hidden animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
          <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight mb-2">Создать аккаунт</h1>
          <p className="text-neutral-400 text-sm font-medium">Бесплатный доступ к AI генератору</p>
        </div>

        <div className="flex w-full justify-center animate-in slide-in-from-bottom-10 fade-in duration-500">
           <SignUp 
             path="/register" 
             routing="path" 
             signInUrl="/login" 
             // Force — not fallback — so Clerk always lands new users on
             // /onboarding for the welcome screen, even when a
             // `redirect_url` query param is present from an inbound flow.
             forceRedirectUrl="/onboarding"
             appearance={{
               elements: {
                 rootBox: "w-full",
                 cardBox: "w-full rounded-none rounded-t-[2.5rem] md:rounded-3xl shadow-none md:shadow-2xl border-x-0 border-b-0 border-t border-white/10 md:border-transparent m-0 pb-10 md:pb-0 relative overflow-hidden bg-white",
                 card: "bg-transparent p-8 md:p-10 w-full",
                 headerTitle: "text-2xl font-black text-neutral-900 hidden md:block",
                 headerSubtitle: "hidden md:block text-neutral-500",
                 socialButtonsBlockButton: "rounded-2xl border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 transition-all font-bold py-4 text-neutral-800 shadow-sm",
                 socialButtonsBlockButtonText: "font-semibold text-neutral-700",
                 socialButtonsProviderIcon: "w-6 h-6",
                 dividerRow: "my-6",
                 dividerLine: "bg-neutral-200",
                 dividerText: "text-sm text-neutral-400 font-medium",
                 formFieldLabel: "text-sm font-bold text-neutral-700",
                 formButtonPrimary: "bg-black hover:bg-hermes-500 text-white rounded-2xl py-4 font-bold transition-all shadow-md mt-2",
                 formFieldInput: "rounded-2xl border-neutral-200 focus:border-hermes-500 focus:ring-hermes-500/20 py-3.5 bg-neutral-50",
                 footerActionLink: "text-hermes-500 font-bold hover:text-hermes-600 transition-colors",
                 footerActionText: "text-neutral-500 font-medium",
               }
             }}
           />
        </div>
      </div>
    </div>
  );
}
