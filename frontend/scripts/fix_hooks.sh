# frontend/scripts/fix_hooks.sh  (full file drop-in)
#!/usr/bin/env bash
set -euo pipefail
shopt -s globstar nullglob

for f in frontend/src/**/*.{js,jsx,ts,tsx}; do
  [ -f "$f" ] || continue
  if grep -qE 'React\.use(State|Effect|Memo|Ref|Context|Callback|Reducer|Id|Transition)\b' "$f"; then
    echo "[rewrite] $f"
    perl -0777 -i -pe '
      s/\bReact\.useState\b/useState/g;
      s/\bReact\.useEffect\b/useEffect/g;
      s/\bReact\.useMemo\b/useMemo/g;
      s/\bReact\.useRef\b/useRef/g;
      s/\bReact\.useContext\b/useContext/g;
      s/\bReact\.useCallback\b/useCallback/g;
      s/\bReact\.useReducer\b/useReducer/g;
      s/\bReact\.useId\b/useId/g;
      s/\bReact\.useTransition\b/useTransition/g;
    ' "$f"

    # ensure some react import exists
    if ! grep -Eq 'from[[:space:]]+["'\''']react["'\''']' "$f"; then
      sed -i '1s;^;import React, { useState, useEffect, useMemo, useRef, useContext, useCallback, useReducer, useId, useTransition } from "react";\n;' "$f"
    fi

    # upgrade "import React from 'react'" to include hooks (idempotent)
    sed -i -E 's#^\s*import\s+React\s+from\s+["'\''']react["'\'''];\s*$#import React, { useState, useEffect, useMemo, useRef, useContext, useCallback, useReducer, useId, useTransition } from "react";#' "$f"
  fi
done
