export interface SuiteDefinition {
  id: string;
  label: string;
  script: string;
  report: string;
}

export const SUITES: Record<string, SuiteDefinition> = {
  all: {
    id: "all",
    label: "Todos",
    script: "scripts/run_maestro_all.sh",
    report: ".maestro/reports/all.xml",
  },
  smoke: {
    id: "smoke",
    label: "Smoke",
    script: "scripts/run_maestro_smoke.sh",
    report: ".maestro/reports/suite.xml",
  },
  stores: {
    id: "stores",
    label: "Lojas",
    script: "scripts/run_maestro_stores.sh",
    report: ".maestro/reports/stores.xml",
  },
  coupons: {
    id: "coupons",
    label: "Cupons",
    script: "scripts/run_maestro_coupons.sh",
    report: ".maestro/reports/coupons.xml",
  },
  navigation: {
    id: "navigation",
    label: "Navegação",
    script: "scripts/run_maestro_navigation.sh",
    report: ".maestro/reports/navigation.xml",
  },
};

export function isKnownSuite(value: string): boolean {
  return value in SUITES;
}
