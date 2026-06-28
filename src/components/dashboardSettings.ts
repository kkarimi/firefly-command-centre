export type DashboardSettings = {
  showSpend: boolean;
  showCash: boolean;
  showFocus: boolean;
  showCategories: boolean;
  showDetailSignals: boolean;
};

export const defaultDashboardSettings: DashboardSettings = {
  showSpend: true,
  showCash: false,
  showFocus: false,
  showCategories: false,
  showDetailSignals: false,
};

export const dashboardSettingsKey = 'firefly-ui-dashboard-settings-v1';
