#!/usr/bin/env python3
"""
init_task.py - Initialize workflow task files for a new task.
Usage: python3 scripts/init_task.py "Task name"
"""

import sys
import os
from datetime import datetime

def init_task(task_name: str):
    os.makedirs("tasks", exist_ok=True)

    todo_content = f"""# Task: {task_name}
**Status**: planning
**Started**: {datetime.now().strftime("%Y-%m-%d %H:%M")}

## Plan
- [ ] Step 1: 
- [ ] Step 2: 
- [ ] Step 3: 

## Open Questions
- (none yet)

## Progress Notes


## Review
(fill in after completion)
- What worked:
- What was tricky:
- Time taken:
"""

    lessons_path = "tasks/lessons.md"
    if not os.path.exists(lessons_path):
        lessons_content = """# Lessons Learned

> Updated after every user correction. Review at session start.

---

## Template
**Date**: YYYY-MM-DD
**Mistake**: what went wrong
**Root cause**: why it happened
**Rule**: specific rule to prevent recurrence
**Pattern**: code or behavior pattern to watch for

---
"""
        with open(lessons_path, "w") as f:
            f.write(lessons_content)
        print(f"✅ Created {lessons_path}")

    todo_path = "tasks/todo.md"
    with open(todo_path, "w") as f:
        f.write(todo_content)
    print(f"✅ Created {todo_path}")
    print(f"\nReady. Fill in your plan steps and begin.")

if __name__ == "__main__":
    name = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Untitled Task"
    init_task(name)
