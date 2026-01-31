# Agent Guidelines

## CRITICAL: No Assumptions Policy

- **NEVER make assumptions** about requirements, implementation details, or user intent, etc.
- If context is missing or unclear, **ASK before proceeding**.
- When in doubt, ask. Don't guess.

## CRITICAL: Code Change Approval Required

Before ANY source code modification (create, edit, delete files), you MUST:

1. **Explain what you plan to do** - list files to be created/modified/deleted
2. **Wait for explicit user approval** before executing changes
3. **Never batch large changes silently** - if implementing a feature requires multiple files, present the plan first

❌ Wrong: "I've added 20 files to implement this feature."  
✅ Right: "To implement this feature, I plan to create 5 new files: [...]. Should I proceed?"

## Workflow

1. **Understand** - Read requirements, ask clarifying questions
2. **Propose** - Present your implementation plan with specific file changes
3. **Confirm** - Wait for user approval
4. **Execute** - Only then make the changes
5. **Report** - Summarize what was done

## Remember

- Break big tasks into smaller steps
- Discuss architecture decisions before coding
