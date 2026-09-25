import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router";
import {
  ForgotPasswordForm,
  LoginForm,
  ResetPasswordForm,
  SignupForm,
  VerifyEmailForm,
  type CustomizationOptions,
} from "wasp/client/auth";
import { Card, CardContent } from "../components/ui/card";

// Wasp's auth forms, wrapped in shadcn cards and themed with the same tokens.
const appearance: CustomizationOptions["appearance"] = {
  colors: {
    brand: "var(--primary)",
    brandAccent: "var(--primary)",
    submitButtonText: "var(--primary-foreground)",
  },
};

function AuthCard({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm space-y-4">
        <Card>
          <CardContent>{children}</CardContent>
        </Card>
        {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}

const linkClass = "font-medium text-foreground underline underline-offset-4";

export function LoginPage() {
  return (
    <AuthCard
      footer={
        <div className="space-y-1">
          <p>
            No account yet? <RouterLink className={linkClass} to="/signup">Sign up</RouterLink>
          </p>
          <p>
            Forgot your password?{" "}
            <RouterLink className={linkClass} to="/request-password-reset">Reset it</RouterLink>
          </p>
        </div>
      }
    >
      <LoginForm appearance={appearance} />
    </AuthCard>
  );
}

export function SignupPage() {
  return (
    <AuthCard
      footer={
        <p>
          Already have an account? <RouterLink className={linkClass} to="/login">Log in</RouterLink>
        </p>
      }
    >
      <SignupForm appearance={appearance} />
    </AuthCard>
  );
}

export function EmailVerificationPage() {
  return (
    <AuthCard footer={<RouterLink className={linkClass} to="/login">Go to login</RouterLink>}>
      <VerifyEmailForm appearance={appearance} />
    </AuthCard>
  );
}

export function RequestPasswordResetPage() {
  return (
    <AuthCard>
      <ForgotPasswordForm appearance={appearance} />
    </AuthCard>
  );
}

export function PasswordResetPage() {
  return (
    <AuthCard footer={<RouterLink className={linkClass} to="/login">Go to login</RouterLink>}>
      <ResetPasswordForm appearance={appearance} />
    </AuthCard>
  );
}
