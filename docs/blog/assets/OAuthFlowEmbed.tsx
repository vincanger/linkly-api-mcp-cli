// Embeds the CIMD OAuth walkthrough (cimd-oauth-flow.html) in an MDX post.
//
// Setup (Docusaurus):
//   1. Copy cimd-oauth-flow.html to static/img/blog/cimd-oauth-flow.html (or pass `src`).
//   2. Put this file in src/components/, then in the post:
//        import OAuthFlowEmbed from "@site/src/components/OAuthFlowEmbed";
//        <OAuthFlowEmbed />
//
// The iframe keeps the walkthrough's CSS, its arrow-key shortcuts, and its
// step hash out of the blog page. The page reports its height, so there's no
// inner scrollbar, and it follows the blog's light/dark toggle.
import React, { useEffect, useRef, useState } from "react";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { useColorMode } from "@docusaurus/theme-common";

type Props = {
  /** Where the HTML file is served from, relative to the site root. */
  src?: string;
  /** Open on this step (1–9) instead of the first one. */
  step?: number;
};

export default function OAuthFlowEmbed({ src = "/img/blog/cimd-oauth-flow.html", step }: Props) {
  const { colorMode } = useColorMode();
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(900);
  const page = useBaseUrl(src);
  const embedUrl = `${page}?embed=1${step ? `&step=${step}` : ""}`;

  // The walkthrough posts its height whenever it changes.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === "cimd-oauth-flow:height" && typeof e.data.height === "number") setHeight(Math.ceil(e.data.height));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Theme goes in by message, not in the URL, so toggling it doesn't reload the iframe.
  const sendTheme = () =>
    frame.current?.contentWindow?.postMessage({ type: "cimd-oauth-flow:theme", theme: colorMode }, "*");
  useEffect(sendTheme, [colorMode]);

  return (
    <figure style={{ margin: "1.5rem 0" }}>
      <iframe
        ref={frame}
        src={embedUrl}
        onLoad={sendTheme}
        title="Step through how an MCP client logs in with CIMD OAuth"
        loading="lazy"
        // colorScheme must match the page inside, or browsers paint an opaque backdrop behind it.
        style={{ width: "100%", height, border: 0, display: "block", colorScheme: colorMode }}
      />
      <figcaption style={{ fontSize: "0.9em", marginTop: "0.5rem" }}>
        <a href={page}>Open the walkthrough on its own page →</a>
      </figcaption>
    </figure>
  );
}
