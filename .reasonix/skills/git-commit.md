# git-commit

Commit and push changes to the current git repository.

## Usage

Invoke with: `run_skill({ name: "git-commit", arguments: "<commit message>" })`

## Steps

1. Run `git add .` to stage all changes
2. Run `git commit -m "<message>"` with the provided commit message
3. Run `git push` to push to the remote

## Notes

- The commit message comes from `arguments`
- If push fails due to credentials, report the error but the commit is still done locally
