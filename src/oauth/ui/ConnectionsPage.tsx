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
import { Checkbox } from "../../components/ui/checkbox";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { ALL_TOOLSETS, TOOLSETS, type Toolset } from "../../shared/scopes";
import type { GrantOut } from "../grants";


/** Connected apps: edit toolsets and the confirmation toggle, or revoke. Changes apply on the app's next request. */
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
              <TableHead>Toolsets</TableHead>
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
  const [toolsets, setToolsets] = useState<Toolset[]>(g.toolsets);
  const [confirm, setConfirm] = useState(g.confirmDestructive);
  useEffect(() => setToolsets(g.toolsets), [g.toolsets]);
  useEffect(() => setConfirm(g.confirmDestructive), [g.confirmDestructive]);

  async function saveToolsets(next: Toolset[]) {
    const previous = toolsets;
    setToolsets(next);
    try {
      await updateGrant({ id: g.id, toolsets: next });
      toast.success("Toolsets updated");
    } catch (e) {
      setToolsets(previous);
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
        <div className="flex flex-col gap-1.5">
          {ALL_TOOLSETS.map((t) => (
            <div key={t} className="flex items-center gap-2">
              <Checkbox
                id={`${g.id}-${t}`}
                checked={toolsets.includes(t)}
                onCheckedChange={(checked) => saveToolsets(checked ? [...toolsets, t] : toolsets.filter((x) => x !== t))}
              />
              <Label htmlFor={`${g.id}-${t}`} className="font-normal">{TOOLSETS[t].label}</Label>
            </div>
          ))}
        </div>
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
