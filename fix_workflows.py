import re

lines = open('client/src/pages/Workflows.tsx').readlines()

# Find the return statement
start = 0
for i, l in enumerate(lines):
    if 'return (' in l and i > 300:
        start = i
        break

# Track tag stack
stack = []
for i in range(start, len(lines)):
    l = lines[i]
    line_num = i + 1
    
    # Find all opening tags (not self-closing)
    for m in re.finditer(r'<(\w+)(?:\s|>)', l):
        tag = m.group(1)
        # Check if this is a self-closing tag on this line
        # Simple heuristic: if /> appears after the tag on same line
        tag_start = m.start()
        rest = l[tag_start:]
        if '/>' in rest and rest.index('/>') < (rest.index('>') if '>' in rest else len(rest)):
            continue
        if tag[0].isupper() or tag == 'div' or tag == 'span' or tag == 'h1' or tag == 'h2' or tag == 'h3' or tag == 'h4' or tag == 'p' or tag == 'ul' or tag == 'li' or tag == 'table' or tag == 'form':
            stack.append((tag, line_num))
    
    # Find all closing tags
    for m in re.finditer(r'</(\w+)>', l):
        tag = m.group(1)
        if stack and stack[-1][0] == tag:
            stack.pop()
        else:
            print(f"  MISMATCH at line {line_num}: closing </{tag}> but stack top is {stack[-1] if stack else 'empty'}")

print(f"\nRemaining unclosed tags ({len(stack)}):")
for tag, line_num in stack:
    print(f"  Line {line_num}: <{tag}>")
