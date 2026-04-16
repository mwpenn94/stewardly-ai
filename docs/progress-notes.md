# Progress Notes

## Current State (Apr 16, 2026)
- App is running, screenshot shows Chat page with Welcome to Stewardly dialog
- Stock ticker has been removed from AppShell (confirmed)
- Client Profile moved to Client Planning nav group (confirmed)
- New files created:
  - aumEngine.ts — AUM override cascade (p²+p−1/3=0), pipeline funnels, activity metrics
  - PanelsG.tsx — AUMOverrideCascadePanel, AUMPipelinePanel, AffiliatePipelinePanel
- Calculators.tsx updated with imports, nav items, and panel rendering
- TSC errors are OOM crashes (exit code 134 = SIGABRT), not actual type errors
- Dev server is serving pages fine (curl returns HTML)

## Next Steps
- Navigate to Wealth Engine to visually verify the 3 new panels render
- Write tests for the new engine functions
- Continue with Domain A-D strategy surfaces
