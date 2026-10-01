import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getGrants, revokeGrant, updateGrant, useQuery } from "wasp/client/operations";
import { errorMessage } from "../../app/ui/errors";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import type { Scope } from "../../shared/scopes";
import type { GrantOut } from "../grants";
import { ScopeChecklist } from "./ScopeChecklist";

/** Connected apps: edit permissions and the confirmation toggle, or revoke. Changes apply on the app's next request. */
export function ConnectionsPage() {
  const { data: grants, error } = useQuery(getGrants);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">Connected apps</h1>
        <p className="text-muted-foreground">
          AI assistants and other apps you've connected with OAuth. Changes apply to the app's next request.
        </p>
      </div>
      {error && <p className="text-destructive">{errorMessage(error)}</p>}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>App</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Confirm deletions</TableHead>
              <TableHead>Connected</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grants?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No connected apps. Add Linkly's MCP URL to an AI assistant to connect one.
                </TableCell>
              </TableRow>
            )}
            {grants?.map((g) => (
              <GrantRow key={g.id} grant={g} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** One connected app. Edits show immediately and roll back if saving fails. */
function GrantRow({ grant: g }: { grant: GrantOut }) {
  const [scopes, setScopes] = useState<Scope[]>(g.scopes);
  const [confirm, setConfirm] = useState(g.confirmDestructive);
  useEffect(() => setScopes(g.scopes), [g.scopes]);
  useEffect(() => setConfirm(g.confirmDestructive), [g.confirmDestructive]);

  async function saveScopes(next: Scope[]) {
    const previous = scopes;
    setScopes(next);
    try {
      await updateGrant({ id: g.id, scopes: next });
      toast.success("Permissions updated");
    } catch (e) {
      setScopes(previous);
      toast.error(errorMessage(e));
    }
  }

  async function saveConfirm(next: boolean) {
    setConfirm(next);
    try {
      await updateGrant({ id: g.id, confirmDestructive: next });
      toast.success("Saved");
    } catch (e) {
      setConfirm(!next);
      toast.error(errorMessage(e));
    }
  }

  return (
    <TableRow data-testid={`grant-${g.clientName}`}>
      <TableCell>
        <div className="font-medium">{g.clientName}</div>
        <div className="text-sm text-muted-foreground">{g.clientHost}</div>
      </TableCell>
      <TableCell>
        <ScopeChecklist idPrefix={g.id} offered={g.requestedScopes} selected={scopes} onChange={saveScopes} />
      </TableCell>
      <TableCell>
        <Switch aria-label={`Require confirmation for ${g.clientName}`} checked={confirm} onCheckedChange={saveConfirm} />
      </TableCell>
      <TableCell>{new Date(g.createdAt).toLocaleDateString()}</TableCell>
      <TableCell>{g.lastUsedAt ? new Date(g.lastUsedAt).toLocaleString() : "Never"}</TableCell>
      <TableCell className="text-right">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm">Revoke</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect {g.clientName}?</AlertDialogTitle>
              <AlertDialogDescription>It loses access immediately. It can ask to connect again later.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={async () => {
                  try {
                    await revokeGrant({ id: g.id });
                    toast.success("Disconnected");
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
              >
                Disconnect
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}
