import { page, route, type Spec } from "@wasp.sh/spec";
import { LoginPage, SignupPage } from "./AuthPages" with { type: "ref" };
import { HomePage } from "./HomePage" with { type: "ref" };

export const appSpec: Spec = [
  route("HomeRoute", "/", page(HomePage)),
  route("LoginRoute", "/login", page(LoginPage)),
  route("SignupRoute", "/signup", page(SignupPage)),
];
