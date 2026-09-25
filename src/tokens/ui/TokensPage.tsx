import { useState } from "react";
import { toast } from "sonner";
import { config } from "wasp/client";
import { createPat, getPats, revokePat, useQuery } from "wasp/client/operations";
import { CopyButton } from "../../app/ui/CopyButton";
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
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { ALL_SCOPES, SCOPES, type Scope } from "../../shared/scopes";

const EXPIRY_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
  { value: "never", label: "Never" },
];

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

export function TokensPage() {
  const { data: pats, error } = useQuery(getPats);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Scope[]>([...ALL_SCOPES]);
  const [expiry, setExpiry] = useState("90");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const openApiUrl = `${config.apiUrl}/api/v1/openapi.json`;

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const result = await createPat({ name, scopes, expiresInDays: expiry === "never" ? null : Number(expiry) });
      setNewToken(result.token);
      setName("");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">Personal access tokens</h1>
        <p className="text-muted-foreground">
          Use a token to call the REST API, run the <code className="rounded bg-muted px-1">linkly</code> CLI, or connect
          an MCP client with a static header. The API is described by{" "}
          <a className="underline underline-offset-4" href={openApiUrl} target="_blank" rel="noreferrer">
            openapi.json
          </a>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New token</CardTitle>
          <CardDescription>The token is shown once. Store it somewhere safe.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="max-w-xl">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="token-name">Name</FieldLabel>
                <Input id="token-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Laptop CLI" required />
              </Field>
              <FieldSet>
                <FieldLegend variant="label">Permissions</FieldLegend>
                {ALL_SCOPES.map((scope) => (
                  <Field key={scope} orientation="horizontal">
                    <Checkbox
                      id={`scope-${scope}`}
                      checked={scopes.includes(scope)}
                      onCheckedChange={(checked) =>
                        setScopes((s) => (checked ? [...s, scope] : s.filter((x) => x !== scope)))
                      }
                    />
                    <FieldLabel htmlFor={`scope-${scope}`} className="font-normal">
                      {SCOPES[scope]} <code className="text-xs text-muted-foreground">{scope}</code>
                    </FieldLabel>
                  </Field>
                ))}
              </FieldSet>
              <Field>
                <FieldLabel htmlFor="token-expiry">Expires</FieldLabel>
                <Select value={expiry} onValueChange={setExpiry}>
                  <SelectTrigger id="token-expiry" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div>
                <Button type="submit" disabled={creating || !name.trim() || scopes.length === 0}>
                  {creating ? "Creating…" : "Create token"}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      {error && <p className="text-destructive">{errorMessage(error)}</p>}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pats?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No tokens yet.</TableCell>
              </TableRow>
            )}
            {pats?.map((pat) => (
              <TableRow key={pat.id}>
                <TableCell className="font-medium">{pat.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {pat.scopes.map((s) => (
                      <Badge key={s} variant="outline">{s}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{formatDate(pat.createdAt)}</TableCell>
                <TableCell>{pat.lastUsedAt ? new Date(pat.lastUsedAt).toLocaleString() : "Never"}</TableCell>
                <TableCell>{pat.expiresAt ? formatDate(pat.expiresAt) : "Never"}</TableCell>
                <TableCell className="text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">Revoke</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke “{pat.name}”?</AlertDialogTitle>
                        <AlertDialogDescription>Anything using this token stops working immediately.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={async () => {
                            try {
                              await revokePat({ id: pat.id });
                              toast.success("Token revoked");
                            } catch (err) {
                              toast.error(errorMessage(err));
                            }
                          }}
                        >
                          Revoke token
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={newToken !== null} onOpenChange={(open) => !open && setNewToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your new token</DialogTitle>
            <DialogDescription>Copy it now. You won't be able to see it again.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border bg-muted p-2">
            <code className="flex-1 break-all text-sm" data-testid="new-token">{newToken}</code>
            {newToken && <CopyButton value={newToken} label="Copy token" />}
          </div>
          <DialogFooter>
            <Button onClick={() => setNewToken(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
