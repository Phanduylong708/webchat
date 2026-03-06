# Agent Guidelines

## CRITICAL: No Assumptions Policy

- **NEVER make assumptions** about requirements, implementation details, or user intent, etc.
- If context is missing or unclear, **ASK before proceeding**.
- When in doubt, ask. Don't guess.
- Do not run destructive commands without asking for permission and explain. (eg: drop database (this can kill an entire system), delete files, etc.)

## CRITICAL: Code Change Approval Required
Note: non critical docs are not counted as source code.
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

## Mindset

- Premature optimization is the root of all evil
- Don't over-engineering

### Naming Convention

- Consistency: If you have chosen a word to describe a concept, use it throughout the project.
- Don't skimp on characters if it reduces clarity. Names should answer the question: What is it? What is it used for? E.g., userdata > data, activeUsers > users > list.
- For function, prioritize Feature/Intent (Business Logic) over Technical Implementation: findEligibleUsers() > loopThroughArrayAndCheckFlags()
