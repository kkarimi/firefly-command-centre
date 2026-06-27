export type DashboardSettings = {
  showSpend: boolean;
  showCash: boolean;
  showFocus: boolean;
  showCategories: boolean;
};

export const defaultDashboardSettings: DashboardSettings = {
  showSpend: true,
  showCash: false,
  showFocus: false,
  showCategories: false,
};

export const dashboardSettingsKey = 'firefly-ui-dashboard-settings-v1';
