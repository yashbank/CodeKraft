# Branch protection for `main` (docs/12 §4.2)

Configure in GitHub → Settings → Branches → Add rule for `main`:

- Require a pull request before merging; 1 approving review; dismiss stale approvals.
- Require status checks: `lint`, `typecheck`, `unit`, `integration`, `build`, `e2e`, `axe` (add `lhci` once public pages exist).
- Require branches to be up to date before merging.
- Require CODEOWNERS review (`.github/CODEOWNERS`).
- Do not allow force pushes or deletions.

GitHub Environment `production` (used by `release.yml`, later): required reviewer = the other founder (mirrors dual approval, BR-13).
