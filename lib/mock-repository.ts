import type { CurrentUser, DashboardSnapshot } from "./types";
import { mockDashboard } from "./mock-data";

export interface DashboardRepository { getSnapshot(actor: CurrentUser): Promise<DashboardSnapshot>; }
export const mockRepository: DashboardRepository = { async getSnapshot(actor) { await new Promise((resolve) => setTimeout(resolve, 120)); return mockDashboard(actor.role); } };

import { isSupabaseConfigured } from "./supabase-browser";
import { supabaseDashboardRepository } from "./supabase-dashboard-repository";

export const dashboardRepository: DashboardRepository = isSupabaseConfigured() ? supabaseDashboardRepository : mockRepository;
