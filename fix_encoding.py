#!/usr/bin/env python3
"""
Script to fix Russian encoding in PlanScreen.tsx
The file appears to be read as Latin-1 but should be UTF-8
"""

# First, let's read the raw bytes from git and write them properly
import subprocess
import sys

# Get the clean version from git
result = subprocess.run(
    ['git', 'show', 'HEAD~1:src/ui/screens/PlanScreen.tsx'],
    capture_output=True,
    text=False  # Get raw bytes
)

if result.returncode != 0:
    print("Failed to get file from git")
    sys.exit(1)

# Write as UTF-8 without BOM
with open('src/ui/screens/PlanScreen.tsx', 'wb') as f:
    f.write(result.stdout)

print("PlanScreen.tsx restored with correct encoding")
