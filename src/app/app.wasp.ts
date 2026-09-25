import { page, route, type Spec } from "@wasp.sh/spec";
import {
  EmailVerificationPage,
  LoginPage,
  PasswordResetPage,
  RequestPasswordResetPage,
  SignupPage,
} from "./AuthPages" with { type: "ref" };
import { HomePage } from "./HomePage" with { type: "ref" };

export const appSpec: Spec = [
  route("HomeRoute", "/", page(HomePage)),
  route("LoginRoute", "/login", page(LoginPage)),
  route("SignupRoute", "/signup", page(SignupPage)),
  route("RequestPasswordResetRoute", "/request-password-reset", page(RequestPasswordResetPage)),
  route("PasswordResetRoute", "/password-reset", page(PasswordResetPage)),
  route("EmailVerificationRoute", "/email-verification", page(EmailVerificationPage)),
];
