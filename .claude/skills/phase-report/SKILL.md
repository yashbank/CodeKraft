---
name: phase-report
description: Print the end-of-phase report for CodeKraft autopilot work. Use after finishing any phase (audit, fix loop, razorpay, finish).
---

Print at most 5 lines, no prose, no headers beyond this:

```
Phase N done | fixed X | open Y | blocked Z | next: <one line>
```

Fill in real numbers from BUGS.md (count status=fixed, status=open, status=blocked) and the concrete next action from PROGRESS.md NEXT line. Nothing else.
