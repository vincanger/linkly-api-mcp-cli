import { Link as RouterLink } from "react-router";
import { config } from "wasp/client";
import { useAuth } from "wasp/client/auth";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { LLMS_TXT_PATH, MCP_PATH } from "../discovery/paths";
import { CopyField } from "./ui/CopyField";
import { useOrigin } from "./useOrigin";

// Prerendered (logged-out view), so the "For AI agents" card is in the HTML an
// agent gets when it fetches the dashboard's address.
export function HomePage() {
  const { data: user } = useAuth();
  return (
    <div className="mx-auto max-w-2xl space-y-12 py-16">
      <section className="space-y-6 text-center">
        <h1 className="font-heading text-4xl font-semibold tracking-tight">Short links, with an MCP server.</h1>
        <p className="text-lg text-muted-foreground">
          Linkly shortens links and counts clicks. Everything the dashboard can do is also available
          through the REST API, the <code className="rounded bg-muted px-1">linkly</code> CLI, and an MCP
          server your AI assistant can connect to.
        </p>
        <div className="flex justify-center gap-3">
          {user ? (
            <Button asChild size="lg">
              <RouterLink to="/links">Go to your links</RouterLink>
            </Button>
          ) : (
            <>
              <Button asChild size="lg">
                <RouterLink to="/signup">Get started</RouterLink>
              </Button>
              <Button asChild size="lg" variant="outline">
                <RouterLink to="/login">Log in</RouterLink>
              </Button>
            </>
          )}
        </div>
      </section>
      <ForAgents />
    </div>
  );
}

function ForAgents() {
  const llmsTxtUrl = useOrigin() + LLMS_TXT_PATH;
  return (
    <Card>
      <CardHeader>
        <CardTitle>For AI agents</CardTitle>
        <CardDescription>
          If you support MCP, connect to Linkly's MCP server and log in with OAuth in the user's browser. Otherwise,
          read <a className="underline underline-offset-4" href={LLMS_TXT_PATH}>llms.txt</a>: it explains how to use
          the REST API, links to the OpenAPI document, and lists the rules.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CopyField label="MCP server" value={config.apiUrl + MCP_PATH} />
        <CopyField label="llms.txt" value={llmsTxtUrl} />
      </CardContent>
    </Card>
  );
}
