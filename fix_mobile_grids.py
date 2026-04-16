"""Fix non-responsive grid-cols-3+ to stack on mobile by adding responsive prefixes."""
import re
import os

# Map: grid-cols-N -> grid-cols-1 sm:grid-cols-N (for N>=3)
# For grid-cols-5 data tables -> add overflow-x-auto wrapper approach instead
# For TabsList grid-cols-3 -> these are fine as tabs compress well

fixes = {
    # EstatePlanning grid-cols-5 data tables - wrap in overflow
    "client/src/pages/EstatePlanning.tsx": [
        ('grid grid-cols-5 gap-2 text-xs', 'grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs'),
        ('grid grid-cols-5 gap-2 text-sm', 'grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm'),
    ],
    # IncomeProjection grid-cols-5 data tables
    "client/src/pages/IncomeProjection.tsx": [
        ('grid grid-cols-5 gap-2 text-xs', 'grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs'),
        ('grid grid-cols-5 gap-2 text-sm', 'grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm'),
    ],
    # TaxPlanning grid-cols-5 data tables
    "client/src/pages/TaxPlanning.tsx": [
        ('grid grid-cols-5 gap-2 text-xs', 'grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs'),
        ('grid grid-cols-5 gap-2 text-sm', 'grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm'),
    ],
    # ClientOnboarding grid-cols-3
    "client/src/pages/ClientOnboarding.tsx": [
        ('grid grid-cols-3 gap-3', 'grid grid-cols-1 sm:grid-cols-3 gap-3'),
    ],
    # LearningQuizRunner grid-cols-3
    "client/src/pages/learning/LearningQuizRunner.tsx": [
        ('grid grid-cols-3 gap-2', 'grid grid-cols-1 sm:grid-cols-3 gap-2'),
    ],
    # BusinessIncome grid-cols-3
    "client/src/pages/wealth-engine/BusinessIncome.tsx": [
        ('grid grid-cols-3 gap-1.5', 'grid grid-cols-1 sm:grid-cols-3 gap-1.5'),
    ],
    # Sensitivity grid-cols-3
    "client/src/pages/wealth-engine/Sensitivity.tsx": [
        ('grid grid-cols-3 gap-3 text-xs', 'grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs'),
    ],
    # StrategyComparison grid-cols-3
    "client/src/pages/wealth-engine/StrategyComparison.tsx": [
        ('grid grid-cols-3 gap-3 pt-1', 'grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1'),
    ],
    # TeamBuilder grid-cols-5
    "client/src/pages/wealth-engine/TeamBuilder.tsx": [
        ('grid grid-cols-5 gap-2 text-[10px]', 'grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px]'),
    ],
}

base = "/home/ubuntu/wealthbridge-ai"
total = 0
for filepath, replacements in fixes.items():
    fullpath = os.path.join(base, filepath)
    if not os.path.exists(fullpath):
        print(f"SKIP: {filepath} not found")
        continue
    content = open(fullpath).read()
    changed = False
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            changed = True
            total += 1
            print(f"FIXED: {filepath}: {old[:50]}...")
        else:
            print(f"SKIP: {filepath}: pattern not found: {old[:50]}...")
    if changed:
        open(fullpath, 'w').write(content)

print(f"\nTotal fixes: {total}")
