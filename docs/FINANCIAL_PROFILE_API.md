# Financial Profile API

The shared financial profile is the force-multiplier data layer that
every calculator, quick-quote flow, and planning page in Stewardly
reads and writes through. Before this API existed, every page held
its own `useState` of the same handful of fields (age, income,
savings, dependents, marginalRate, …) and users had to re-enter them
on every page.

This document is the contract for adding new consumers, new fields,
and new prefill flows. Future contributors **must** follow this guide
so the profile stays consistent across the 15+ calculator pages
in the app.

## Where the code lives

| Layer        | Path                                                    | Purpose                                                                  |
| ------------ | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Pure store   | `client/src/stores/financialProfile.ts`                 | Types, sanitization, merge, completeness, diff. **No React imports.**    |
| React hook   | `client/src/hooks/useFinancialProfile.ts`               | Read / write / cross-tab sync via the `storage` event.                   |
| Banner UI    | `client/src/components/financial-profile/FinancialProfileBanner.tsx` | Drop-in "profile ready" chip + "Use saved profile" CTA.    |
| Tests        | `client/src/stores/financialProfile.test.ts`            | 36 unit tests covering parse, sanitize, merge, completeness, diff, etc. |

## The shape

```ts
interface FinancialProfile {
  // Core — used by nearly every calculator
  age?: number;
  income?: number;
  netWorth?: number;
  savings?: number;
  monthlySavings?: number;
  dependents?: number;
  mortgage?: number;
  debts?: number;
  marginalRate?: number;
  equitiesReturn?: number;
  existingInsurance?: number;
  isBizOwner?: boolean;

  // Retirement-specific
  retirementAge?: number;
  yearsInRetirement?: number;
  desiredRetirementIncome?: number;

  // Estate / tax
  stateOfResidence?: string;
  filingStatus?: "single" | "mfj" | "mfs" | "hoh" | "qw";
  estateGoal?: "minimize_tax" | "maximize_gift" | "charitable" | "none";

  // Insurance / protection
  lifeInsuranceCoverage?: number;
  hasLtc?: boolean;
  hasDisability?: boolean;
  hasHomeowner?: boolean;

  // Business owner (BIE feeder)
  businessRevenue?: number;
  businessEmployees?: number;
  businessRole?: "new" | "exp" | "sa" | "dir" | "md" | "rvp" | "partner";

  // Meta
  updatedAt?: string;
  source?: "user" | "quick_quote" | "advisor_intake" | "csv_import" | "api";
}
```

Every field is optional. The store auto-sanitizes (clamps numerics,
filters non-boolean flag values, validates enum strings, drops NaN
and Infinity). Unknown keys are dropped on the way in via
`sanitizeProfile`.

## Reading the profile from a calculator

```tsx
import { useFinancialProfile } from "@/hooks/useFinancialProfile";

function MyCalculator() {
  const { profile, hasProfile, completeness } = useFinancialProfile();

  // Use profile.age, profile.income, etc directly. They may be
  // undefined — handle that with `??` defaults.
  const age = profile.age ?? 35;
  const income = profile.income ?? 100_000;

  return <div>...</div>;
}
```

## Writing back to the profile

Always call `setProfile` with a **partial** patch. The hook merges
over the existing profile, re-sanitizes the result, bumps `updatedAt`,
and tags `source`.

```tsx
const { setProfile } = useFinancialProfile();

// Push form changes back to the shared profile
const onSubmit = () => {
  setProfile(
    {
      age: form.age,
      income: form.income,
      retirementAge: form.retirementAge,
    },
    "user", // or "quick_quote" / "advisor_intake" / "csv_import" / "api"
  );
};
```

## Dropping the banner into a new page

Every calculator should mount the `FinancialProfileBanner` at the top
of its main card. The banner shows the user's current completeness
and provides a one-click "Use saved profile" button that calls back
into your local prefill handler.

```tsx
import { FinancialProfileBanner } from "@/components/financial-profile/FinancialProfileBanner";
import type { FinancialProfile } from "@/stores/financialProfile";

const handlePrefill = (p: FinancialProfile) => {
  if (p.age !== undefined) setAge(p.age);
  if (p.income !== undefined) setIncome(p.income);
  // …
};

<FinancialProfileBanner
  onPrefill={handlePrefill}
  usesFields={["age", "income", "savings"]}
/>
```

The `usesFields` array is shown in the banner so the user knows
which fields will be prefilled. Pass an empty array (or omit it)
if you want to skip the field-count summary.

### Pattern: late hydration

If your component reads `profile` once at mount time, you may need
to re-prefill when the profile loads asynchronously (e.g., the
hook hasn't finished reading `localStorage` yet on the very first
render). Use a `useRef` flag + `useEffect` to do the prefill exactly
once when `hasProfile` flips to `true`:

```tsx
const didInitialPrefillRef = useRef(hasProfile);

useEffect(() => {
  if (!didInitialPrefillRef.current && hasProfile) {
    didInitialPrefillRef.current = true;
    handlePrefill(profile);
  }
}, [hasProfile, profile]);
```

## Feeding the profile into wealth-engine tRPC procedures

The tRPC procedures expect a canonical `ClientProfile` shape. Use
`engineProfile` from the hook (it's already shaped via
`toEngineProfile` which strips UI-only fields the engines don't
understand):

```tsx
const { engineProfile } = useFinancialProfile();

const runPreset = trpc.wealthEngine.runPreset.useMutation();

runPreset.mutate({
  preset: "wealthbridgeClient",
  profile: engineProfile,
  years: 30,
});
```

## Adding a new field

1. Add the field to `FinancialProfile` in
   `client/src/stores/financialProfile.ts`.
2. If it's numeric, add it to `NUMERIC_FIELDS` so the sanitizer
   coerces and clamps it. Add a custom clamp range in `clampFor` if
   the default `(0, 1e12)` doesn't fit.
3. If it's a boolean, add it to `BOOLEAN_FIELDS`.
4. If it's an enum, add an explicit guard in `sanitizeProfile`.
5. If it's part of "completeness", add it to either
   `CORE_COMPLETENESS_FIELDS` (weighted 70%) or the non-core list
   (weighted 30%) inside `profileCompleteness`.
6. If the engine routers need it, add it to the `engineKeys` list
   in `toEngineProfile`.
7. Add a unit test to
   `client/src/stores/financialProfile.test.ts` covering the
   sanitization edge cases (NaN, out-of-range, wrong type).

## Cross-tab sync

The hook listens to the `storage` event on `window`. If a user
opens two tabs and edits their profile in one, the other tab will
see the update on the next render — no extra wiring needed.

## Persistence model

- **Today (pass 1-3):** localStorage only, per-device. Survives
  refresh, lost on browser clear / new device.
- **Future (gap G9 in PARITY.md):** server-side persistence via
  `financialProfile.get/set` tRPC procedures backed by a new
  `financial_profiles` table in the drizzle schema. The hook will
  be wrapped in a `useQuery` + optimistic mutation so the
  localStorage acts as a write-through cache.

## Testing

Pure helpers (parse, sanitize, merge, completeness, diff,
toEngineProfile) are exercised by 36 unit tests in
`client/src/stores/financialProfile.test.ts`. The React hook is
intentionally **not** tested directly today — its behavior is
covered indirectly by the consumer tests on each calculator that
uses it. If you add a new pure helper, add a unit test to the
existing file rather than spinning up a separate suite.

## Anti-patterns

- **Don't fork the shape inline.** If you find yourself defining a
  local `interface MyCalculatorProfile` with the same fields,
  use `FinancialProfile` and a partial-pick instead.
- **Don't write directly to `localStorage`.** Always go through
  `setProfile` so the cross-tab sync + sanitization runs.
- **Don't pass the React hook into a deeply-nested child.** Read
  `profile` at the top of the page and pass primitives down. The
  hook is fine to call multiple times in the same component, but
  prop-drilling primitives is cheaper than re-subscribing.
- **Don't mutate the returned `profile` object.** It's a snapshot.
  Use `setProfile` to apply a patch.
