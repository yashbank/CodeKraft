#!/bin/zsh
# usage: ready.sh <id> <branch> <worktree> "<test note>" ["<log line>"]  -- push branch, mark ready, log, push coord
R=/Users/iauro/Desktop/Projects/CodeKraft; C=$R/.coord/docs/coord/B.md
git -C "$3" push -q origin HEAD:refs/heads/$2 2>&1 | grep -v '^remote' ; git -C $R/.coord pull -q --ff-only
python3 - "$C" "$1" "$2" "$4" "$5" <<'PY'
import sys,re;p,i,b,n,l=sys.argv[1:];s=open(p).read()
line=f"- {i} | ready | branch {b} | {n}"
s=re.sub(rf"^- {re.escape(i)} \|.*$",line,s,flags=re.M) if re.search(rf"^- {re.escape(i)} \|",s,re.M) else s.replace("## Requests to A",line+"\n## Requests to A",1)
if l: s=s.rstrip("\n")+f"\n- 2026-10-29 {i}: {l}\n"
open(p,'w').write(s)
PY
git -C $R/.coord commit -qam "sync(B): $1 ready" && git -C $R/.coord push -q origin coord && echo "ready $1"
