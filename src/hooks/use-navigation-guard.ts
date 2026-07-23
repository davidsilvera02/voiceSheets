"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Warns before leaving the page while there are unsaved changes.
 * - Blocks browser tab close / refresh via `beforeunload`.
 * - Intercepts in-app link clicks and surfaces `pendingHref` so the caller can
 *   render a Save / Discard / Cancel dialog. Call `proceed(href)` to navigate
 *   past the guard, or `cancel()` to stay.
 *
 * (Next.js App Router has no built-in client navigation guard, so we intercept
 * anchor clicks at the document level — this covers sidebar links and buttons.)
 */
export function useNavigationGuard(dirty: boolean) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const bypass = useRef(false);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty && !bypass.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    function onClick(e: MouseEvent) {
      if (bypass.current) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      const target = anchor.getAttribute("target");
      if (
        !href ||
        target === "_blank" ||
        href.startsWith("http") ||
        href.startsWith("#") ||
        href.startsWith("mailto:")
      ) {
        return;
      }
      if (href === window.location.pathname + window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(href);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty]);

  const proceed = useCallback(
    (href?: string) => {
      bypass.current = true;
      setPendingHref(null);
      router.push(href ?? pendingHref ?? "/");
    },
    [router, pendingHref],
  );

  const cancel = useCallback(() => setPendingHref(null), []);

  return { pendingHref, proceed, cancel };
}
