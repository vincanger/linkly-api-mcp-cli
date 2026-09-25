import { Link as RouterLink } from "react-router";
import { useAuth } from "wasp/client/auth";
import { Button } from "../components/ui/button";

export function HomePage() {
  const { data: user } = useAuth();
  return (
    <section className="mx-auto max-w-2xl space-y-6 py-16 text-center">
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
  );
}
