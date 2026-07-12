ALTER TABLE todo
ADD COLUMN project_id INTEGER REFERENCES project(id) ON DELETE SET NULL;

CREATE INDEX idx_todo_project ON todo(project_id);
