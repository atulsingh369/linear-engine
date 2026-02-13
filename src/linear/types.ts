export interface StorySpec {
  title: string;
  description: string;
  assignee?: string;
  milestone?: string;
}

export interface EpicSpec {
  title: string;
  description: string;
  assignee?: string;
  milestone?: string;
  stories?: StorySpec[];
}

export interface ProjectSpec {
  project: {
    name: string;
    description: string;
  };
  milestones?: {
    name: string;
  }[];
  epics?: EpicSpec[];
}
