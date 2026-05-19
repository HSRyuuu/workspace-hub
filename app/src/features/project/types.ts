export interface Project {
  id: number;
  title: string;
  description: string | null;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectDirectory {
  id: number;
  project_id: number;
  path: string;
  label: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewProjectInput {
  title: string;
  description?: string | null;
  color?: string | null;
  sort_order?: number | null;
}

export interface UpdateProjectPatch {
  title?: string;
  description?: string;
  color?: string;
  sort_order?: number;
}

export interface NewProjectDirectoryInput {
  project_id: number;
  path: string;
  label?: string | null;
}

export interface UpdateProjectDirectoryPatch {
  path?: string;
  label?: string;
}

export interface ProjectApplication {
  id: number;
  project_id: number;
  path: string;
  label: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewProjectApplicationInput {
  project_id: number;
  path: string;
  label?: string | null;
}

export interface UpdateProjectApplicationPatch {
  path?: string;
  label?: string;
}
