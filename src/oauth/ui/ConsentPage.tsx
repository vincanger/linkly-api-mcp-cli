import { ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "wasp/client/auth";
import { approveAuthorization, denyAuthorization, getAuthorizeRequest, useQuery } from "wasp/client/operations";
import { rememberReturnTo } from "../../app/returnTo";
import { errorMessage } from "../../app/ui/errors";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "../../components/ui/field";
import { Skeleton } from "../../components/ui/skeleton";
import { Switch } from "../../components/ui/switch";
import { ALL_TOOLSETS, SCOPES, TOOLSETS, type Toolset } from "../../shared/scopes";
import type { AuthorizeParams } from "../authorize";

const PARAM_KEYS = ["response_type", "client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state", "scope", "resource"] as const;

/** The OAuth authorization endpoint: validates the request and asks the user to consent. */
export function ConsentPage() {
  const [search] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: user, isLoading: authLoading } = useAuth();

  const params = useMemo(() => {
    const p: AuthorizeParams = {};
    for (const key of PARAM_KEYS) {
      const value = search.get(key);
      if (value !== null) p[key] = value;
    }
    return p;
  }, [search]);

  // Not logged in: log in first, then come back with the full query string.
  useEffect(() => {
    if (!authLoading && !user) {
      rememberReturnTo(location.pathname + location.search);
      navigate("/login", { replace: true });
    }
  }, [authLoading, user, location, navigate]);

  const { data, error, isLoading } = useQuery(getAuthorizeRequest, params, { enabled: !!user, retry: false });

  // Redirectable errors (bad scope, missing PKCE...) go back to the client.
  useEffect(() => {
    if (data && !data.ok) window.location.assign(data.redirectTo);
  }, [data]);

  const [toolsets, setToolsets] = useState<Toolset[] | null>(null);
  const [confirmDestructive, setConfirmDestructive] = useState(true);
  const [submitting, setSubmitting] = useState<"allow" | "deny" | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (authLoading || !user || isLoading || (data && !data.ok)) {
    return <Skeleton className="mx-auto h-96 w-full max-w-lg" />;
  }

  if (error || !data) {
    // Invalid client_id or redirect_uri: show the problem, never redirect.
    return (
      <Card className="mx-auto max-w-lg" data-testid="authorize-error">
        <CardHeader>
          <CardTitle>This app can't connect to Linkly</CardTitle>
          <CardDescription>{errorMessage(error ?? "Invalid authorization request.")}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The app sent an authorization request Linkly can't accept. You can close this tab.
        </CardContent>
      </Card>
    );
  }

  const selected = toolsets ?? data.defaultToolsets;
  const offered = ALL_TOOLSETS.filter((t) => TOOLSETS[t].scopes.some((s) => data.requestedScopes.includes(s)));

  async function submit(kind: "allow" | "deny") {
    setSubmitting(kind);
    setSubmitError(null);
    try {
      const { redirectTo } =
        kind === "allow"
          ? await approveAuthorization({ params, toolsets: selected, confirmDestructive })
          : await denyAuthorization({ params });
      window.location.assign(redirectTo);
    } catch (e) {
      setSubmitError(errorMessage(e));
      setSubmitting(null);
    }
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle className="text-xl">
          Allow <span data-testid="client-name">{data.clientName}</span> to access your Linkly account?
        </CardTitle>
        <CardDescription className="space-y-2">
          <span className="block">
            App address: <strong className="text-foreground" data-testid="client-host">{data.clientHost}</strong>
          </span>
          <span className="flex items-start gap-2 rounded-md bg-muted p-2 text-foreground">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            Linkly hasn't verified this app. Only continue if you trust {data.clientHost}.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <FieldSet>
            <FieldLegend variant="label">What it can do</FieldLegend>
            <FieldDescription>Searching docs and opening dashboard links are always allowed.</FieldDescription>
            {offered.map((t) => (
              <Field key={t} orientation="horizontal">
                <Checkbox
                  id={`toolset-${t}`}
                  checked={selected.includes(t)}
                  onCheckedChange={(checked) =>
                    setToolsets(checked ? [...selected, t] : selected.filter((x) => x !== t))
                  }
                />
                <FieldContent>
                  <FieldLabel htmlFor={`toolset-${t}`}>{TOOLSETS[t].label}</FieldLabel>
                  <FieldDescription>
                    {TOOLSETS[t].scopes.filter((s) => data.requestedScopes.includes(s)).map((s) => SCOPES[s]).join(" · ")}
                  </FieldDescription>
                </FieldContent>
              </Field>
            ))}
          </FieldSet>
          <Field orientation="horizontal">
            <Switch id="confirm-destructive" checked={confirmDestructive} onCheckedChange={setConfirmDestructive} />
            <FieldContent>
              <FieldLabel htmlFor="confirm-destructive">Require confirmation for destructive actions</FieldLabel>
              <FieldDescription>Deletions send you a link to confirm in Linkly instead of happening right away.</FieldDescription>
            </FieldContent>
          </Field>
        </FieldGroup>
        {submitError && <p className="mt-4 text-sm text-destructive">{submitError}</p>}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" disabled={!!submitting} onClick={() => submit("deny")}>
          Deny
        </Button>
        <Button disabled={!!submitting} onClick={() => submit("allow")}>
          {submitting === "allow" ? "Allowing…" : "Allow"}
        </Button>
      </CardFooter>
    </Card>
  );
}
