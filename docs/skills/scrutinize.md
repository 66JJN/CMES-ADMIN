# Scrutinize (from 9arm-skills)

Outsider-perspective end-to-end review of a plan, PR, or code change.

## Workflow
1. **Intent**: Is there a simpler, smaller, or more elegant way to achieve the same goal?
2. **Trace**: Walk the actual code path end-to-end (not just the diff).
3. **Verify**: Does it actually do what it claims? What edge cases break it?
4. **Report**: Blocker -> Major -> Nit with evidence and suggested change.
