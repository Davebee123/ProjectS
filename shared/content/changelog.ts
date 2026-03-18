export type ChangelogCategory = "new" | "changes" | "ui" | "fixes";

export interface ChangelogEntry {
  category: ChangelogCategory;
  text: string;
  source: "auto" | "manual";
}

export interface ChangelogReleaseSpec {
  version: string;
  date: string;
  title?: string;
  compareTo?: string | null;
  target: "snapshot" | "current";
}

export interface ChangelogConfig {
  releases: ChangelogReleaseSpec[];
}

export interface ChangelogRelease {
  version: string;
  date: string;
  title?: string;
  entries: ChangelogEntry[];
}

export interface ChangelogData {
  generatedAt: string;
  releases: ChangelogRelease[];
}
