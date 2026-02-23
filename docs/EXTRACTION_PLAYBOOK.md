# Extraction Playbook

<!-- Guidelines for extracting and organizing code. Tag list for commit messages. -->

## Commit Tags

<!-- Use these tags in commit message Tags: footer -->

- `setup` - Project setup and configuration
- `docs` - Documentation changes
- `feature` - New feature implementation
- `fix` - Bug fixes
- `refactor` - Code restructuring without behavior change
- `style` - Formatting, naming, whitespace
- `test` - Adding or updating tests
- `perf` - Performance improvements
- `deps` - Dependency changes
- `ci` - CI/CD pipeline changes
- `ux` - User experience improvements
- `cleanup` - Removing dead code, unused files
- `security` - Security fixes or improvements
- `a11y` - Accessibility improvements

## Extraction Guidelines

- Extract when a file exceeds 500 lines
- Extract when a function exceeds 100 lines
- Extract when a component exceeds 400 lines
- Group related functionality into logical directories
- Prefer smaller, focused files and functions
