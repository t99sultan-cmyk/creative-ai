import { SignUp } from "@clerk/nextjs";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4 py-24">
      <SignUp path="/register" routing="path" signInUrl="/login" />
    </div>
  );
}
