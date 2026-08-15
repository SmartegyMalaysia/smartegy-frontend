import type { DashboardSnapshot, UserRole } from "./types";
import { mockDashboard } from "./mock-data";

export interface DashboardRepository { getSnapshot(role: UserRole): Promise<DashboardSnapshot>; }
export const mockRepository: DashboardRepository = { async getSnapshot(role) { await new Promise((resolve) => setTimeout(resolve, 120)); return mockDashboard(role); } };

import { isSupabaseConfigured } from "./supabase-browser";
import { supabaseDashboardRepository } from "./supabase-dashboard-repository";

export const dashboardRepository: DashboardRepository = isSupabaseConfigured() ? supabaseDashboardRepository : mockRepository;
