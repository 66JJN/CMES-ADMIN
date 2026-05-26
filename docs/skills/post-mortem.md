# Engineering Post-mortem (from 9arm-skills)

The canonical engineering record of a bug fix.

## Required inputs
- [ ] Reliable repro exists.
- [ ] Root cause is known.
- [ ] Fix is identified.
- [ ] Fix is validated.

## Structure
1. **Summary**: What broke, what fixed it.
2. **Symptom**: Concrete identifiers of failure.
3. **Root cause**: Mechanism (code identifiers welcome).
4. **Why it produced the symptom**: Link cause to observation.
5. **Fix**: What changed and why.
6. **How it was found**: Debugging path/experiments.
7. **Why it slipped through**: Gap in process/CI.
8. **Validation**: How we know it works.
9. **Action items**: Next steps to prevent recurrence.
