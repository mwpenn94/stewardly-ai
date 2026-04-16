"""
Fix accessibility: Add role="button", tabIndex={0}, and onKeyDown handler
to clickable non-button elements that have cursor-pointer but lack keyboard support.
"""
import re
import os

ROOT = "/home/ubuntu/wealthbridge-ai"

# Pattern: element with cursor-pointer and onClick but no keyboard support
# We'll add role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); <original onClick handler> } }}
# This is a targeted fix for the most common pattern: <Card ... className="cursor-pointer ..." onClick={...}>

files_to_fix = [
    "client/src/pages/AdvisoryHub.tsx",
    "client/src/pages/AgentManager.tsx",
    "client/src/pages/ApiDocumentation.tsx",
    "client/src/pages/Community.tsx",
    "client/src/pages/Help.tsx",
    "client/src/pages/PublicCalculators.tsx",
    "client/src/pages/Workflows.tsx",
    "client/src/pages/learning/LearningHome.tsx",
]

# Pattern to match: cursor-pointer ... onClick={<handler>}
# We need to extract the onClick handler and add keyboard support
pattern = re.compile(
    r'(className="[^"]*cursor-pointer[^"]*")\s+(onClick=\{([^}]+)\})',
    re.MULTILINE
)

fixed_count = 0
for rel in files_to_fix:
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        print(f"SKIP: {rel} not found")
        continue
    
    with open(path, 'r') as f:
        content = f.read()
    
    def add_a11y(match):
        global fixed_count
        classname = match.group(1)
        onclick_full = match.group(2)
        handler = match.group(3).strip()
        
        # Skip if already has role="button" or tabIndex or onKeyDown nearby
        # (check 200 chars around match)
        start = max(0, match.start() - 100)
        end = min(len(content), match.end() + 100)
        context = content[start:end]
        if 'role="button"' in context or 'tabIndex' in context or 'onKeyDown' in context:
            return match.group(0)
        
        fixed_count += 1
        # Build the keyboard handler
        # Handle arrow functions and function references
        if handler.startswith('()'):
            # Arrow function: () => something
            keyboard_handler = f'onKeyDown={{(e: React.KeyboardEvent) => {{ if (e.key === "Enter" || e.key === " ") {{ e.preventDefault(); ({handler})(); }} }}}}'
        else:
            # Function reference or complex expression
            keyboard_handler = f'onKeyDown={{(e: React.KeyboardEvent) => {{ if (e.key === "Enter" || e.key === " ") {{ e.preventDefault(); ({handler})(); }} }}}}'
        
        return f'{classname} role="button" tabIndex={{0}} {onclick_full} {keyboard_handler}'
    
    new_content = pattern.sub(add_a11y, content)
    
    if new_content != content:
        with open(path, 'w') as f:
            f.write(new_content)
        print(f"FIXED: {rel}")
    else:
        print(f"NO CHANGES: {rel}")

print(f"\nTotal fixes: {fixed_count}")
