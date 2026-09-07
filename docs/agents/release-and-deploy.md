# Release and Deploy

## Merge gate

Before merge, the PR must include the issue number, acceptance-criteria mapping, test results, migration notes, and rollback notes. Required repository checks are lint, typecheck, tests, and production build when the change can affect runtime behavior.

The target branch is `master`. Merging to `master` triggers `.github/workflows/deploy-ftps.yml`; the workflow also remains manually runnable for recovery.

## Production deployment

The workflow builds a fresh artifact in GitHub Actions, uploads it over FTPS, applies it over SSH, and runs the remote verification script. Credentials remain GitHub Actions Secrets and must never be copied into the repository, `.env`, logs, or issue comments.

Deployments are serialized with GitHub Actions concurrency. A failed build, upload, apply, or verification step fails the workflow and must not be reported as successful.

## Recovery

1. Stop further deploys by resolving the failing run before retrying.
2. Inspect the failed step and the remote apply/verify output; do not paste secrets into tickets.
3. Re-run the last known-good workflow or revert the offending merge through a normal PR.
4. Verify the live site from the remote verification path.
5. Record the incident and corrective action in the related Issue or PR.

Production deployment is not considered complete until the workflow is green and the remote health check succeeds.