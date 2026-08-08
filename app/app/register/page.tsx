import RegisterOpenForm from "./RegisterOpenForm";
import Link from "next/link";

export default function OpenRegisterPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-1">
          <div className="text-5xl">🏎️</div>
          <h1 className="text-2xl font-bold">Join GarageMeet</h1>
          <p className="text-sm text-gray-500">Free forever · No credit card</p>
        </div>

        <RegisterOpenForm />

        <p className="text-xs text-center text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="text-amber-400 hover:underline">Sign in</Link>
        </p>
        <p className="text-xs text-center text-gray-700">
          By signing up you agree to use this responsibly and not be a jerk about it. 🙂
        </p>
      </div>
    </div>
  );
}
