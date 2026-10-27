export const workspaceRouteByView = {
  workspace: "/dashboard",
  intake: "/dashboard/claims/new",
  review: "/dashboard/claims/review",
  claims: "/dashboard/claims",
  products: "/dashboard/products",
  "add-product": "/dashboard/products/new",
  "amazon-import": "/dashboard/products/import",
  assistant: "/dashboard/assistant",
  prices: "/dashboard/price-watch",
  reminders: "/dashboard/reminders",
  timeline: "/dashboard/timeline",
  settings: "/dashboard/settings",
  help: "/dashboard/help",
} as const;

export type WorkspaceView = keyof typeof workspaceRouteByView;

const viewByRoute = new Map<string, WorkspaceView>(
  Object.entries(workspaceRouteByView).map(([view, route]) => [route, view as WorkspaceView]),
);

export function workspaceViewForPathname(pathname: string): WorkspaceView | null {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (normalizedPath === "/") return "workspace";
  return viewByRoute.get(normalizedPath) ?? null;
}
