import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate, useParams } from "react-router";
import { useAuth } from "wasp/client/auth";
import { cancelPendingAction, confirmPendingAction, getPendingAction, useQuery } from "wasp/client/operations";
import { rememberReturnTo } from "../../app/returnTo";
import { errorMessage } from "../../app/ui/errors";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";

/** /confirm/:actionId: the human confirms (or cancels) what an app asked to do. */
export function ConfirmActionPage() {
  const { actionId = "" } = useParams();
  const { data: user, isLoading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      rememberReturnTo(location.pathname);
      navigate("/login", { replace: true });
    }
  }, [authLoading, user, location, navigate]);

  const { data: action, error, isLoading, refetch } = useQuery(getPendingAction, { actionId }, { enabled: !!user, retry: false });

  if (authLoading || !user || isLoading) return <Skeleton className="mx-auto h-64 w-full max-w-lg" />;

  if (error || !action) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>Confirmation not found</CardTitle>
          <CardDescription>{errorMessage(error ?? "This confirmation link isn't valid for your account.")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function act(kind: "confirm" | "cancel") {
    setBusy(true);
    setSubmitError(null);
    try {
      await (kind === "confirm" ? confirmPendingAction({ actionId }) : cancelPendingAction({ actionId }));
    } catch (e) {
      setSubmitError(errorMessage(e));
    } finally {
      setBusy(false);
      void refetch();
    }
  }

  const details = (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">Short link</dt>
      <dd className="font-medium">/r/{action.link.slug}</dd>
      <dt className="text-muted-foreground">Goes to</dt>
      <dd className="break-all">{action.link.destinationUrl}</dd>
      <dt className="text-muted-foreground">Requested by</dt>
      <dd className="font-medium" data-testid="requested-by">{action.requestedBy}</dd>
    </dl>
  );

  if (action.status !== "pending") {
    const states = {
      completed: { icon: <CheckCircle2 className="size-5" />, title: "Link deleted", text: "This request was confirmed. The link is gone." },
      cancelled: { icon: <XCircle className="size-5" />, title: "Request cancelled", text: "Nothing was deleted." },
      expired: { icon: <Clock className="size-5" />, title: "This request expired", text: "Nothing was deleted. Ask the app to try again if you still want to delete the link." },
    } as const;
    const s = states[action.status];
    return (
      <Card className="mx-auto max-w-lg" data-testid={`action-${action.status}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">{s.icon} {s.title}</CardTitle>
          <CardDescription>{s.text}</CardDescription>
        </CardHeader>
        <CardContent>{details}</CardContent>
        <CardFooter>
          <Button variant="outline" asChild>
            <RouterLink to="/links">Back to links</RouterLink>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Delete this link?</CardTitle>
        <CardDescription>
          {action.requestedBy} asked to delete a link. It won't be deleted unless you confirm. This request expires at{" "}
          {new Date(action.expiresAt).toLocaleTimeString()}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {details}
        <p className="text-sm text-muted-foreground">Deleting removes the link and its click history permanently.</p>
        {submitError && <p className="text-sm text-destructive">{submitError}</p>}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={() => act("cancel")}>Cancel</Button>
        <Button variant="destructive" disabled={busy} onClick={() => act("confirm")}>Confirm delete</Button>
      </CardFooter>
    </Card>
  );
}
