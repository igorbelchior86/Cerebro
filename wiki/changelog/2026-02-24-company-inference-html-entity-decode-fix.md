# Company Inference HTML Entity Decode Fix

# What changed
- Updated `PrepareContext.inferCompanyNameFromTicketText(...)` to decode basic HTML entities (`&amp;`, `&nbsp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`) before applying company extraction regex patterns.

# Why it changed
- Ticket `T20260221.0001` displayed the wrong company after processing (`Garmonandcompany`) even though the Autotask email body contained the correct phrase `created for GARMON & CO. INC.`.
- The parser was matching against raw HTML/entity-encoded text and failed to extract the company, falling back to domain-based inference.

# Impact (UI / logic / data)
- **UI**: Company name should remain correct after processing for HTML emails containing entity-encoded names.
- **Logic**: Company inference becomes more reliable for Autotask email HTML bodies.
- **Data**: `SSOT.company` and `evidence_pack.org.name` should stop regressing to domain-derived company labels when explicit company text exists.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-02-24
