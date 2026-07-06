#!/bin/bash
# Run pyright on a single file and inject errors as hook additionalContext.
# Usage: pyright_check.sh <file_path>
f="$1"
[ -f "$f" ] || exit 0
command -v pyright >/dev/null 2>&1 || exit 0

out=$(pyright "$f" 2>&1)
errors=$(echo "$out" | grep " - error:" | head -20)
[ -z "$errors" ] && exit 0

python3 -c "
import json, sys
f, errors = sys.argv[1], sys.argv[2]
print(json.dumps({
    'hookSpecificOutput': {
        'hookEventName': 'PostToolUse',
        'additionalContext': f'PYRIGHT TYPE ERRORS in {f}:\n{errors}'
    }
}))
" "$f" "$errors"
