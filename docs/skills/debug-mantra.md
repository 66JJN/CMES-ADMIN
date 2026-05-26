# Debug Mantra (from 9arm-skills)

Four-step discipline for any debug session. Recite verbatim, then apply in order.

## Mantra:
> 1. **First is reproducibility.** Can the issue be reproduced reliably?
> 2. **Know the fail path.** Debugger first; then source trace + knob enumeration; then in-code instrumentation.
> 3. **Question your hypothesis.** What would disprove it?
> 4. **Every run is a breadcrumb.** Cross-reference all of them.

---

## 1. Reproduce reliably
Build a runnable repro before anything else. deterministically.

## 2. Know the fail path
Once reproducible, find where the code breaks.
1. Attach a debugger.
2. Source trace + knob enumeration.
3. In-code instrumentation.

## 3. Falsify the hypothesis
What is the simplest proof? What is the cleanest disproof? Run the disproof first.

## 4. Every run is a breadcrumb
Maintain a ledger of every experiment. Does a new hypothesis hold for EVERY prior observation?
