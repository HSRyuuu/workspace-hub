import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectTodosSection } from "../ProjectTodosSection";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

describe("ProjectTodosSection", () => {
  it("renders linked todo titles and status badges", async () => {
    invokeMock.mockResolvedValue([
      {
        id: 1,
        workspace_id: null,
        project_id: 7,
        title: "Linked hold todo",
        description: null,
        start_date: "2026-07-01",
        due_date: null,
        due_time: 0,
        priority: "mid",
        status: "hold",
        completed_at: null,
        created_at: "2026-07-01T00:00:00Z",
        updated_at: "2026-07-01T00:00:00Z",
      },
    ]);

    render(<ProjectTodosSection projectId={7} />);

    expect(await screen.findByText("Linked hold todo")).toBeInTheDocument();
    expect(screen.getByText("보류")).toBeInTheDocument();
    expect(invokeMock).toHaveBeenCalledWith("todo_list_by_project", { projectId: 7 });
  });
});
