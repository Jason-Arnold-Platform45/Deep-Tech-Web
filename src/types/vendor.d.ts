// Ambient type declarations for packages that ship no TypeScript definitions.

declare module "ssrf-req-filter" {
  import type { Agent } from "http";

  /**
   * Returns an HTTP or HTTPS agent that blocks requests to private/internal
   * IP address ranges, preventing SSRF attacks.
   *
   * @param url - The target URL (used to decide http vs https agent).
   */
  function ssrfFilter(url: string): Agent;

  namespace ssrfFilter {
    /**
     * Wraps an existing agent with SSRF-blocking behaviour.
     */
    function requestFilterHandler(agent: Agent): Agent;
  }

  export = ssrfFilter;
}
