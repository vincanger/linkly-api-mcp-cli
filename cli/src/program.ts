import { Command, CommanderError, Option } from "commander";
import { createApi, unwrap } from "./api.js";
import { clearToken, configPath, readConfig, resolveToken, resolveUrl, writeConfig, type GlobalOptions } from "./config.js";
import { CliError, EXIT } from "./errors.js";
import { fields, printError, printResult, table, type Io } from "./output.js";
import type { components } from "./schema.js";

type Link = components["schemas"]["Link"];

const RANGES = ["24h", "7d", "30d", "90d"];
const collect = (value: string, previous: string[] = []) => [...previous, value];

function linkFields(link: Link): string {
  return fields([
    ["Short URL", link.shortUrl],
    ["Slug", link.slug],
    ["Destination", link.destinationUrl],
    ["Title", link.title],
    ["Tags", link.tags.length ? link.tags.join(", ") : null],
    ["Archived", link.archived ? "yes" : "no"],
    ["ID", link.id],
    ["Dashboard", link.dashboardUrl],
  ]);
}

function examples(...lines: string[]): string {
  return `\nExamples:\n${lines.map((l) => `  $ ${l}`).join("\n")}\n`;
}

/**
 * Builds the `linkly` program. Rules for agents: never prompt, JSON when
 * piped, errors on stderr, meaningful exit codes, --yes for deletes.
 */
export function buildProgram(io: Io, readStdin: () => Promise<string>): Command {
  const program = new Command("linkly")
    .description("Linkly from the command line: short links and click stats, over the REST API.")
    .version("1.0.0")
    .addOption(new Option("--url <url>", "Linkly server URL (default: $LINKLY_URL, the config file, or http://localhost:3001)"))
    .addOption(new Option("--token <token>", "Personal access token (default: $LINKLY_TOKEN or the config file)"))
    .option("--json", "Print the raw JSON response (the default when output is piped)")
    .showHelpAfterError("(run with --help for usage)")
    .exitOverride()
    .configureOutput({ writeOut: (s) => io.stdout(s), writeErr: (s) => io.stderr(s) })
    .addHelpText(
      "after",
      examples("linkly auth login --token lk_pat_...", "linkly links create https://example.com --slug launch", "linkly links list --json | jq '.data[].shortUrl'"),
    );

  const g = (): GlobalOptions => program.opts<GlobalOptions>();
  const api = () => createApi(resolveUrl(g()), resolveToken(g()));
  const out = (data: unknown, human: () => string) => printResult(io, g(), data, human);

  program
    .command("whoami")
    .description("Show who the token belongs to and what it can do.")
    .addHelpText("after", examples("linkly whoami"))
    .action(async () => {
      const { data } = await unwrap(api().GET("/me"));
      out(data, () => fields([["Email", data.email], ["User ID", data.userId], ["Token", data.source], ["Scopes", data.scopes.join(" ")], ["Dashboard", data.dashboardUrl]]));
    });

  // ── links ─────────────────────────────────────────────────────────────
  const links = program.command("links").description("List, create, update, and delete short links.");

  links
    .command("list")
    .description("List your links, newest first.")
    .option("--search <text>", "Match slug, title, or destination (case-insensitive)")
    .option("--tag <tag>", "Only links with this tag")
    .option("--archived", "Show archived links instead of active ones")
    .option("--limit <n>", "Links per page, 1–100 (default 25)")
    .option("--cursor <cursor>", "Continue from a previous page's nextCursor")
    .option("--all", "Fetch every page")
    .addHelpText("after", examples("linkly links list --tag promo", "linkly links list --all --json"))
    .action(async (opts: { search?: string; tag?: string; archived?: boolean; limit?: string; cursor?: string; all?: boolean }) => {
      const client = api();
      const query = { search: opts.search, tag: opts.tag, archived: opts.archived ? "true" : undefined, limit: opts.limit, cursor: opts.cursor };
      let page = (await unwrap(client.GET("/links", { params: { query: query as never } }))).data;
      const data = [...page.data];
      while (opts.all && page.nextCursor) {
        page = (await unwrap(client.GET("/links", { params: { query: { ...query, cursor: page.nextCursor } as never } }))).data;
        data.push(...page.data);
      }
      const result = { data, nextCursor: opts.all ? null : page.nextCursor };
      out(result, () =>
        table(
          ["SLUG", "SHORT URL", "DESTINATION", "TAGS"],
          data.map((l) => [l.slug, l.shortUrl, l.destinationUrl, l.tags.join(",")]),
        ) + (result.nextCursor ? `\n\nMore: linkly links list --cursor ${result.nextCursor}` : ""),
      );
    });

  links
    .command("get")
    .description("Show one link, by ID or slug.")
    .argument("<id-or-slug>", "The link's ID or slug")
    .addHelpText("after", examples("linkly links get summer-sale"))
    .action(async (id: string) => {
      const { data } = await unwrap(api().GET("/links/{id}", { params: { path: { id } } }));
      out(data, () => linkFields(data));
    });

  links
    .command("create")
    .description("Create a short link. Omit --slug for a random 7-character one.")
    .argument("<url>", "Destination URL (http:// or https://)")
    .option("--slug <slug>", "Custom slug: 3–40 chars of a-z, 0-9, '-'")
    .option("--title <title>", "A label for the link")
    .option("--tag <tag>", "Add a tag (repeatable, up to 10)", collect)
    .addHelpText("after", examples("linkly links create https://example.com/sale --slug summer-sale --tag promo --tag q3"))
    .action(async (url: string, opts: { slug?: string; title?: string; tag?: string[] }) => {
      const { data } = await unwrap(api().POST("/links", { body: { destinationUrl: url, slug: opts.slug, title: opts.title, tags: opts.tag } }));
      out(data, () => `Created ${data.shortUrl}\n\n${linkFields(data)}`);
    });

  links
    .command("update")
    .description("Change a link. Only the options you pass change; --tag replaces all tags.")
    .argument("<id-or-slug>", "The link's ID or slug")
    .option("--destination <url>", "New destination URL")
    .option("--slug <slug>", "New slug (the old short URL stops working)")
    .option("--title <title>", "New title (pass an empty string to remove it)")
    .option("--tag <tag>", "Set tags (repeatable; replaces the list)", collect)
    .option("--archived", "Archive: stop redirecting without deleting")
    .option("--unarchive", "Restore an archived link")
    .addHelpText("after", examples("linkly links update summer-sale --destination https://example.com/new", "linkly links update summer-sale --archived"))
    .action(async (id: string, opts: { destination?: string; slug?: string; title?: string; tag?: string[]; archived?: boolean; unarchive?: boolean }) => {
      if (opts.archived && opts.unarchive) throw new CliError("Pass either --archived or --unarchive, not both.", EXIT.usage, "usage");
      const body = {
        destinationUrl: opts.destination,
        slug: opts.slug,
        title: opts.title === undefined ? undefined : opts.title || null,
        tags: opts.tag,
        archived: opts.archived ? true : opts.unarchive ? false : undefined,
      };
      if (Object.values(body).every((v) => v === undefined)) {
        throw new CliError("Nothing to change. Pass at least one of --destination, --slug, --title, --tag, --archived, --unarchive.", EXIT.usage, "usage");
      }
      const { data } = await unwrap(api().PATCH("/links/{id}", { params: { path: { id } }, body }));
      out(data, () => `Updated ${data.shortUrl}\n\n${linkFields(data)}`);
    });

  links
    .command("delete")
    .description("Permanently delete a link and its click history. Requires --yes.")
    .argument("<id-or-slug>", "The link's ID or slug")
    .option("--yes", "Confirm the deletion (required; there is no prompt)")
    .addHelpText("after", examples("linkly links delete summer-sale --yes"))
    .action(async (id: string, opts: { yes?: boolean }) => {
      if (!opts.yes) {
        throw new CliError(`Refusing to delete without --yes. Re-run: linkly links delete ${id} --yes`, EXIT.usage, "confirmation_required");
      }
      const { data } = await unwrap(api().DELETE("/links/{id}", { params: { path: { id } } }));
      out(data, () =>
        data.status === "deleted"
          ? `Deleted /r/${data.slug}`
          : `${data.message}\nConfirm here: ${data.confirmUrl}`,
      );
    });

  // ── analytics ─────────────────────────────────────────────────────────
  program
    .command("stats")
    .description("Click stats for a link: per day (zero-filled) or per referrer.")
    .argument("<id-or-slug>", "The link's ID or slug")
    .addOption(new Option("--range <range>", "Time window").choices(RANGES).default("7d"))
    .addOption(new Option("--group-by <groupBy>", "Group clicks by").choices(["day", "referrer"]).default("day"))
    .addHelpText("after", examples("linkly stats summer-sale --range 30d", "linkly stats summer-sale --group-by referrer"))
    .action(async (id: string, opts: { range: string; groupBy: string }) => {
      const { data } = await unwrap(
        api().GET("/links/{id}/stats", { params: { path: { id }, query: { range: opts.range, groupBy: opts.groupBy } as never } }),
      );
      out(data, () => `${data.total} clicks on /r/${data.slug} (${data.range}, by ${data.groupBy})\n\n${table([data.groupBy === "day" ? "DAY" : "REFERRER", "CLICKS"], data.series.map((s) => [s.key, String(s.clicks)]))}\n\nChart: ${data.dashboardUrl}`);
    });

  program
    .command("top-links")
    .description("Your most-clicked links in a time window.")
    .addOption(new Option("--range <range>", "Time window").choices(RANGES).default("7d"))
    .option("--limit <n>", "How many, 1–50 (default 10)")
    .addHelpText("after", examples("linkly top-links --range 30d --limit 5"))
    .action(async (opts: { range: string; limit?: string }) => {
      const { data } = await unwrap(api().GET("/analytics/top-links", { params: { query: { range: opts.range, limit: opts.limit } as never } }));
      out(data, () => table(["CLICKS", "SLUG", "DESTINATION"], data.data.map((d) => [String(d.clicks), d.link.slug, d.link.destinationUrl])));
    });

  // ── docs ──────────────────────────────────────────────────────────────
  const docs = program.command("docs").description("Search and read Linkly's documentation (no token needed).");
  const publicApi = () => createApi(resolveUrl(g()));

  docs
    .command("search")
    .description("Find docs about a topic.")
    .argument("<query...>", "What you want to know")
    .addHelpText("after", examples('linkly docs search how are clicks counted'))
    .action(async (words: string[]) => {
      const { data } = await unwrap(publicApi().GET("/docs/search", { params: { query: { q: words.join(" ") } } }));
      out(data, () => data.results.map((r) => `${r.slug}  ${r.title}\n  ${r.snippet}`).join("\n\n") || "No docs match.");
    });

  docs
    .command("read")
    .description("Print a doc as Markdown.")
    .argument("<slug>", "The doc's slug, from `linkly docs search`")
    .addHelpText("after", examples("linkly docs read how-clicks-are-counted"))
    .action(async (slug: string) => {
      const { data } = await unwrap(publicApi().GET("/docs/{slug}", { params: { path: { slug } } }));
      out(data, () => `# ${data.title}\n\n${data.markdown}`);
    });

  // ── auth ──────────────────────────────────────────────────────────────
  const auth = program.command("auth").description("Store or remove your token (never prompts).");

  auth
    .command("login")
    .description("Verify a personal access token and save it to the config file (mode 0600).")
    .option("--token-stdin", "Read the token from stdin instead of --token (keeps it out of shell history)")
    .addHelpText("after", examples("linkly auth login --token lk_pat_...", "echo $TOKEN | linkly auth login --token-stdin"))
    .action(async (opts: { tokenStdin?: boolean }) => {
      // `--token` is the global option, so it works before or after `auth login`.
      const token = opts.tokenStdin ? (await readStdin()).trim() : g().token;
      if (!token) {
        throw new CliError(
          "Pass --token <token> or --token-stdin. Create a token on the Tokens page of your Linkly dashboard (/settings/tokens).",
          EXIT.usage,
          "usage",
        );
      }
      const url = resolveUrl(g());
      const { data } = await unwrap(createApi(url, token).GET("/me"));
      writeConfig({ ...readConfig(), url, token });
      out({ ...data, configPath: configPath() }, () => `Logged in to ${url} as ${data.email ?? data.userId}. Saved to ${configPath()}.`);
    });

  auth
    .command("logout")
    .description("Remove the saved token from the config file.")
    .action(() => {
      const removed = clearToken();
      out({ removed, configPath: configPath() }, () => (removed ? `Removed the token from ${configPath()}.` : "No saved token."));
    });

  return program;
}

/** Runs the CLI and returns the exit code. */
export async function run(argv: string[], io: Io, readStdin: () => Promise<string>): Promise<number> {
  const program = buildProgram(io, readStdin);
  try {
    await program.parseAsync(argv);
    return EXIT.ok;
  } catch (e) {
    if (e instanceof CommanderError) {
      if (e.code === "commander.helpDisplayed" || e.code === "commander.version" || e.code === "commander.help") return EXIT.ok;
      return EXIT.usage; // commander already printed the message to stderr
    }
    const error = e instanceof CliError ? e : new CliError((e as Error).message ?? String(e), EXIT.unexpected, "unexpected");
    printError(io, program.opts(), error);
    return error.exitCode;
  }
}
