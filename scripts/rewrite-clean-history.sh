#!/usr/bin/env bash
# Rewrite history → 1 clean commit. Run from repo root:
#   bash scripts/rewrite-clean-history.sh
set +e
cd /var/www/html/admin.vitravel.dev || exit 1

# Leave any half-done orphan state
CUR=$(git branch --show-current 2>/dev/null)
echo "Current branch: $CUR"

if git show-ref --verify --quiet refs/heads/clean-main; then
  if [ "$CUR" != "clean-main" ]; then
    git checkout clean-main
  fi
else
  git checkout --orphan clean-main
fi

git rm -rf --cached . 2>/dev/null
git add -A

BAD=$(git ls-files | grep -E '^(node_modules|\.next|out)/' | wc -l)
COUNT=$(git ls-files | wc -l)
echo "Tracked: $COUNT  forbidden: $BAD"
if [ "$BAD" -ne 0 ]; then
  echo "ERROR: forbidden paths still staged"
  git ls-files | grep -E '^(node_modules|\.next|out)/' | head
  exit 1
fi

NAME=$(git log -1 --format='%an' main 2>/dev/null)
EMAIL=$(git log -1 --format='%ae' main 2>/dev/null)
[ -z "$NAME" ] && NAME=phupv
[ -z "$EMAIL" ] && EMAIL=phupv@local

export GIT_AUTHOR_NAME="$NAME" GIT_AUTHOR_EMAIL="$EMAIL"
export GIT_COMMITTER_NAME="$NAME" GIT_COMMITTER_EMAIL="$EMAIL"
git commit -m "Initial clean commit: admin source only (no node_modules/.next)."
git branch -D main 2>/dev/null
git branch -M main

git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo "OK"
git log --oneline -3
du -sh .git
echo "Next: git push --force origin main"
