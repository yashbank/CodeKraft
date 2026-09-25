/**
 * Dashboard widgets service contract — docs/06 §2.7 API-ADM-13/14, docs/04 §7.6, D-120.
 * Registry (`registry.ts`) and loaders land in P7.
 */
import type { RequestContext } from "@/lib/authz/context";
import type {
  DashboardLayoutResult,
  LoadWidgetDataInput,
  SaveDashboardLayoutInput,
  WidgetDataResult,
  WidgetDefinition,
  WidgetKey,
  WidgetMeta,
} from "./types";

export interface WidgetRegistry {
  register<TData>(definition: WidgetDefinition<TData>): void;
  get(key: WidgetKey): WidgetDefinition;
  all(): readonly WidgetDefinition[];
  /** Widgets the caller may add (filtered by `requiredPermission`). */
  availableFor(ctx: RequestContext): WidgetMeta[];
}

export interface DashboardWidgetsService {
  /** API-ADM-13 `getDashboardLayout` — saved layout (or the default) + `availableWidgets`. */
  getDashboardLayout(ctx: RequestContext): Promise<DashboardLayoutResult>;

  /** API-ADM-13 `saveDashboardLayout` — `dashboard_layouts`; `VALIDATION` for unknown/unpermitted keys. */
  saveDashboardLayout(
    ctx: RequestContext,
    input: SaveDashboardLayoutInput,
  ): Promise<DashboardLayoutResult>;

  /** API-ADM-14 `loadWidgetData` — `FORBIDDEN` without the widget's `requiredPermission`; 60 s cache; not audited. */
  loadWidgetData(ctx: RequestContext, input: LoadWidgetDataInput): Promise<WidgetDataResult>;
}
