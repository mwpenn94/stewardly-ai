# Tour System Diagnosis

## Two tour systems exist:
1. **GuidedTour** (GuidedTour.tsx) — Rendered in App.tsx, uses `stewardry_tour_completed` localStorage key, 5 steps, targets data-tour attributes
2. **OnboardingTour** (OnboardingTour.tsx) — NOT rendered anywhere in the app, uses `onboarding_tour_completed` localStorage key, 15 steps

## Problems:
1. GuidedTour uses old `stewardry_tour_completed` localStorage key (should be `stewardly_tour_completed`)
2. GuidedTour renders at App level but targets elements on Chat page — if user lands on a non-chat page, targets won't be found
3. OnboardingTour is never mounted — it's imported nowhere
4. Two competing tour systems create confusion
5. The GuidedTour auto-starts on first visit but may fail if chat elements aren't rendered yet (e.g., user is on landing page)

## Fix Plan:
1. Fix the localStorage key from `stewardry_tour_completed` to `stewardly_tour_completed`
2. Make GuidedTour only activate when user is on the /chat page
3. Add a "Restart Tour" option to the ContextualHelp panel
4. Ensure tour elements are visible before highlighting
