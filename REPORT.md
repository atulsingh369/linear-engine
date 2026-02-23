# Codebase Analysis Report: linear-engine

This report outlines the architecture, identifies performance bottlenecks, and suggests refactoring opportunities for the `linear-engine` codebase.

## Architecture Overview

`linear-engine` is a TypeScript-based command-line interface (CLI) and HTTP API wrapper for the Linear issue tracking system. It's designed to facilitate AI-driven workflows by providing a deterministic, scriptable layer over Linear.

### Key Components:

1.  **CLI (`src/cli.ts`)**:
    -   Built using `yargs`.
    -   Parses command-line arguments and dispatches commands to the core logic.
    -   Handles output formatting (JSON or human-readable).

2.  **API Server (`src/api/`)**:
    -   Built using `Hono`.
    -   Exposes the same core functionality as the CLI via HTTP endpoints.
    -   Includes authentication middleware (`x-exec-secret`).

3.  **Core Logic (`src/core/index.ts`)**:
    -   Acts as a facade/orchestrator.
    -   Delegates specific business logic to the `src/linear/` modules.
    -   Ensures separation of concerns between the interface (CLI/API) and the domain logic.

4.  **Linear Client (`src/linear/client.ts`)**:
    -   Wraps the official `@linear/sdk`.
    -   Handles authentication and error normalization.
    -   Provides utility methods for finding users, projects, and issues.

5.  **Sync Engine (`src/linear/sync.ts`)**:
    -   Implements a declarative synchronization mechanism.
    -   Takes a JSON spec (`ProjectSpec`) and aligns a Linear project's state (milestones, epics, stories) with it.
    -   Handles creation and updates of entities.

## Bottlenecks

### 1. N+1 API Calls
The most significant performance bottleneck is the repeated fetching of data from the Linear API, particularly within loops.

-   **User Resolution**: The `resolveDesiredAssigneeId` function in `src/linear/sync.ts` is called for every epic and story in the sync spec. It calls `client.findUserByIdentifier`, which in turn calls `client.getUsers`. The `getUsers` method fetches *all* users from the API on every call.
    -   **Impact**: For a spec with 10 stories, this could result in 10+ full user list fetches, leading to slow execution and potential rate limiting.

-   **Project Resolution**: Similarly, `client.getProjectByName` fetches *all* projects to find a match. This is called multiple times during sync and other commands.

### 2. Inefficient Lookups (O(N))
The current implementation relies on fetching all items (users, projects) and filtering them in memory using array methods like `find`.

-   **Users**: `users.find(...)` iterates over the entire user list for every lookup.
-   **Projects**: `projects.find(...)` iterates over the entire project list.
-   **Impact**: While memory usage might be acceptable for small-to-medium workspaces, the CPU time for repeated linear searches adds up, especially when combined with the N+1 fetching issue.

### 3. Missing Pagination
The `LinearApiClient` methods (e.g., `getUsers`, `getProjects`, `getIssuesByProject`) return `result.nodes`, which typically contains only the first page of results (default is usually 50).

-   **Impact**: If a workspace has more than 50 users or projects, the tool will fail to find entities that are not on the first page, leading to incorrect behavior (e.g., "User not found" errors).

### 4. Heavy Data Loading in Sync
The `ensureEpicsAndStories` function fetches *all* issues for a project upfront (`client.getIssuesByProject`).

-   **Impact**: For large projects with thousands of issues, this initial fetch can be slow and memory-intensive, even if the sync spec only touches a few items.

## Refactoring Opportunities

### 1. Implement Caching in `LinearApiClient`
-   **Action**: Cache the results of `getUsers`, `getProjects`, and `getTeams` within the `LinearApiClient` instance.
-   **Benefit**: Eliminates redundant API calls. The first call fetches data, and subsequent calls use the cache. This is safe for CLI execution as data is unlikely to change during the run.

### 2. Optimize Data Structures for Lookups
-   **Action**: Transform lists of users and projects into Maps (hash maps) indexed by ID, email, name, or other identifiers.
-   **Benefit**: Reduces lookup complexity from O(N) to O(1).

### 3. Add Pagination Support
-   **Action**: Update `LinearApiClient` methods to handle pagination. They should iterate through all pages (using `pageInfo` and `after` cursor) to ensure all entities are retrieved.
-   **Benefit**: Ensures correctness for larger workspaces.

### 4. Refactor `sync.ts`
-   **Action**:
    -   Break down the monolithic `ensureEpicsAndStories` function into smaller, more focused functions (e.g., `syncEpic`, `syncStory`).
    -   Use the cached/optimized lookups from the improved `LinearApiClient`.
    -   Consider batching updates if the Linear API supports it (though currently it seems to rely on individual mutations).

### 5. Improve Type Safety
-   **Action**: Review `src/linear/client.ts` and replace manual property checks and `any` casts with proper type guards or updated SDK types.
-   **Benefit**: Reduces runtime errors and improves code maintainability.
