import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4 py-24">
      <SignIn path="/login" routing="path" signUpUrl="/register" />
    </div>
  );
}
