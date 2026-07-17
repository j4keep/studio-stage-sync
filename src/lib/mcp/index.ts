import { defineMcp } from "@lovable.dev/mcp-js";
import getFeaturedContent from "./tools/get-featured-content";
import askJhi from "./tools/ask-jhi";

export default defineMcp({
  name: "wheuat-mcp",
  title: "WHEUAT",
  version: "0.1.0",
  instructions:
    "Tools for WHEUAT — a mobile-first platform for independent artists and creators. Use `get_featured_content` to browse recent podcasts, videos, songs, battles, or posts. Use `ask_jhi` to consult YAJ Buddy, YAJ's AI community companion, for creative ideas, music, opportunities, Circles, collaboration, and platform guidance.",
  tools: [getFeaturedContent, askJhi],
});
