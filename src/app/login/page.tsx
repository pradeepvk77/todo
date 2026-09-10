"use client";

import { useActionState } from "react";
import { loginAction, AuthFormState } from "@/app/actions/auth";
import { KeyRound, Lock, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    loginAction,
    {}
  );

  return (
    <main className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 bg-background text-foreground">
      <div className="w-full max-w-md space-y-8">
        {/* Header Icon & Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/10">
            <KeyRound className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Welcome to TaskFlow
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto leading-relaxed">
              Please enter your personal access string to verify your identity and access your tasks.
            </p>
          </div>
        </div>

        {/* Auth Form Card */}
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <form action={formAction} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="accessKey"
                className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Personal Access String
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="accessKey"
                  name="accessKey"
                  type="password"
                  required
                  placeholder="Enter your secret key..."
                  className="block w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                  autoComplete="off"
                />
              </div>
            </div>

            {state?.error && (
              <div className="flex items-center gap-2 text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-lg animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
            >
              {pending ? (
                <span>Verifying...</span>
              ) : (
                <>
                  <span>Authenticate & Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Privacy Note */}
          <div className="pt-4 border-t border-border text-center flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Server-side verification • End-to-end encrypted session</span>
          </div>
        </div>
      </div>
    </main>
  );
}
