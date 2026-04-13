# Pass 2 Audit Notes

## Fresh Novel Audit (Wide, Deep, Comprehensive)

### A. Architecture & Code Quality
1. **Default calculator**: Currently defaults to "iul" (Protect pillar). Since Plan has the most calculators and is the first pillar shown, should default to "ret" (Retirement) for better UX flow.
2. **Unused import**: `pil` (usePlatformIntelligence) is assigned but never used in the component.
3. **ScenarioBar base score**: The baseScore variable uses `find` on results - should handle case where baseline isn't found.
4. **TrajectoryChart gradient ID**: Uses hardcoded "traj-fill" which could conflict if multiple charts render on the same page.

### B. Accessibility
5. **Calculator selector buttons**: Using native `<button>` elements - good for keyboard nav. But no `aria-pressed` or `aria-current` to indicate the active calculator.
6. **SliderInput**: Uses shadcn Slider which has built-in ARIA. Good.
7. **Score ring**: No `aria-label` on the SVG - screen readers can't interpret the score.
8. **Peer benchmark bar**: No text alternative for the visual bar chart.

### C. UX Polish
9. **Scenario overlay legend**: When scenarios are shown, the trajectory chart legend only shows "Net Worth" and "Retirement" but not the scenario lines.
10. **Print / Share button**: Uses `window.print()` which prints the entire page. Should scope to the calculator panel.
11. **Mobile**: Calculator selector grid goes to 2 cols on mobile - might be tight for 7 Plan calculators. Consider horizontal scroll on mobile.
12. **Empty calc state**: The empty state message is generic. Could be more specific per calculator.

### D. Data Integrity
13. **usePersistedSlider**: When profile changes, the persisted value might be stale. Should reset when profile updates.
14. **Stress test scenarios query**: Uses `useQuery` which fires on mount even if stress test isn't selected.

### E. Feature Completeness
15. **No export/download**: No way to export calculator results as PDF or share a link.
16. **No comparison mode**: Can't compare results across different input scenarios within the same calculator.
17. **Multiple income streams**: Still not implemented (marked as pending in todo).

### Priority Actions for Pass 2:
- [P1] Fix default calculator to "ret" 
- [P1] Add aria-pressed to calculator selector buttons
- [P1] Add aria-label to ScoreRing SVG
- [P2] Fix unused `pil` import
- [P2] Add scenario legend to trajectory chart when overlays are active
- [P2] Add aria-label to PeerBenchmarkBar
- [P3] Consider stale persisted slider values when profile changes
