export interface VersionItem {
  date: string;
  branch: string;
  buildNumber: string;
  sha: string;
}

export interface Versions {
  frontend: VersionItem;
  backend: VersionItem;
}
