export interface Schedule {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewScheduleInput {
  title: string;
  start: string;
  end: string;
  all_day?: boolean;
  description?: string | null;
  location?: string | null;
  color?: string | null;
}

export interface UpdateSchedulePatch {
  title?: string;
  start?: string;
  end?: string;
  all_day?: boolean;
  /** 빈 문자열은 NULL 비우기 신호 */
  description?: string;
  location?: string;
  color?: string;
}
