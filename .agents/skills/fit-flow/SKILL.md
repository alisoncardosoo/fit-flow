```markdown
# fit-flow Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns used in the `fit-flow` TypeScript codebase. You'll learn the project's coding conventions, file organization, import/export styles, and how to write and run tests. While no formal workflows were detected, this guide provides best practices and suggested commands to streamline your development process.

## Coding Conventions

### File Naming
- **Convention:** PascalCase for all files.
- **Example:**  
  ```
  UserProfile.ts
  WorkoutSession.test.ts
  ```

### Import Style
- **Convention:** Use alias imports for modules.
- **Example:**
  ```typescript
  import { UserService } from '@services/UserService';
  ```

### Export Style
- **Convention:** Mixed usage of named and default exports.
- **Examples:**
  ```typescript
  // Named export
  export function calculateBMI(weight: number, height: number): number { ... }

  // Default export
  export default class WorkoutSession { ... }
  ```

### Commit Patterns
- **Style:** Freeform commit messages, no enforced prefixes.
- **Average Length:** 77 characters.
- **Example:**
  ```
  Add hydration tracking to workout summary
  ```

## Workflows

### Adding a New Feature
**Trigger:** When implementing a new feature or module  
**Command:** `/add-feature`

1. Create a new PascalCase file for your feature (e.g., `NewFeature.ts`).
2. Use alias imports for dependencies.
3. Export your main function or class (named or default as appropriate).
4. Write corresponding tests in a `NewFeature.test.ts` file.
5. Commit with a descriptive, freeform message.

### Writing and Running Tests
**Trigger:** When verifying code correctness  
**Command:** `/run-tests`

1. Create a test file named `FeatureName.test.ts`.
2. Implement tests using your preferred testing framework.
3. Run tests with the project's test runner (framework unspecified; check project scripts).
4. Review results and refactor code as needed.

## Testing Patterns

- **File Pattern:** All test files follow the `*.test.*` naming convention.
- **Framework:** Not specified; use the framework configured in the project.
- **Example:**
  ```typescript
  // UserProfile.test.ts
  describe('UserProfile', () => {
    it('should calculate age correctly', () => {
      // test implementation
    });
  });
  ```

## Commands
| Command        | Purpose                                 |
|----------------|-----------------------------------------|
| /add-feature   | Scaffold and implement a new feature    |
| /run-tests     | Run all test files in the codebase      |
```
