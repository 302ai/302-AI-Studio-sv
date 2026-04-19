---
name: commit-and-pr
description: "Use this skill whenever the user wants to commit changes and create a Pull Request (e.g., 'commit and PR', 'push my changes', 'create a PR'). It automates branch checkout, conventional commits, and uses the create-github-pull-request-from-specification skill to open a PR."
---

# Commit and Pull Request Workflow

This skill automates the process of committing local changes, pushing to a new branch, and opening a Pull Request using the project's PR template.

## Important Rule
**NEVER proceed without asking the user for the target base branch.** Even if the user provides a prompt like "commit and PR this", you must stop and ask them for the target branch (e.g., `dev/26.16`, `master`) before doing any Git operations.

## Process Steps

Follow these steps exactly in order:

1. **Verify State & Ask for Information**:
   - Run `git branch --show-current` to save the name of the original branch.
   - Run `git status` and `git diff` to understand the current changes.
   - Ask the user: "What should the target base branch be for this PR? (And optionally, what do you want to name the new branch?)"
   - **WAIT** for the user's response. Do not proceed to step 2 until they answer.

2. **Checkout Branch (CRITICAL)**:
   - If the user did not provide a branch name, generate one based on the changes using conventional prefixes (e.g., `feat/xxx`, `fix/xxx`, `chore/xxx`).
   - **CRITICAL RULE:** If the current branch is the same as the target base branch the user specified, you MUST checkout a new branch (e.g., `git checkout -b <new-branch-name>`). You must NEVER commit and push directly to the target base branch.
   - Run `git checkout -b <branch-name>` (or `git checkout <branch-name>` if the user provided an existing one and it's not the base branch).

3. **Commit Code**:
   - Write a conventional commit message describing the changes.
   - Run `git commit -m "..."`.

4. **Push Code**:
   - Run `git push -u origin <branch-name>`.

5. **Create the PR using Specification Skill**:
   - Once the code is pushed, you must use the `create-github-pull-request-from-specification` skill to create the PR.
   - Invoke the skill tool passing the target base branch the user provided:
     `Tool call: Skill (skill: "create-github-pull-request-from-specification", args: "--base <target-branch>")`

6. **Cleanup**:
   - Switch back to the original branch captured in step 1: `git checkout <original-branch>`.

7. **Completion**:
   - Inform the user that the PR has been created and you have switched back to the original branch.
