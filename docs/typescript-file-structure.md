# TypeScript file and module structure rules

Established: 2026-09-16. These rules apply to new TypeScript and TSX code and guide incremental refactoring of existing files. They are guardrails, not a mandate to split stable code mechanically.

## Outcomes required from a refactor

Every extraction must produce at least one concrete improvement and should normally produce two:

1. **Testability:** important behavior becomes directly testable without mounting an unrelated UI or starting the complete application.
2. **Conflict isolation:** independently changing features live in different files, reducing edits to a shared high-churn file.
3. **Readability:** a new contributor can identify a file's purpose, public API and dependencies within roughly 30 seconds.

Do not merge a refactor whose only benefit is a lower line count. Record the intended benefit and verify behavior before and after the move.

## File boundaries

- Apply the single-responsibility principle at the feature level. A file may coordinate one feature, but must not combine unrelated UI rendering, network/storage effects and complex data transformation.
- Keep pure domain transformations independent of React, browser globals and transport code. They belong in named modules and receive their inputs explicitly.
- Keep API calls and persistence adapters at integration boundaries. UI components call a focused callback or hook rather than constructing unrelated requests inline.
- Extract reusable or stateful React behavior into a focused custom hook when it owns a coherent lifecycle, such as block-lasso selection or direct-link target reveal.
- Keep presentation components focused on rendering and local interaction. Large dialogs, panels and tree rows should be separate components when they can have a small explicit props contract.
- Put shared, non-trivial interfaces in `*.types.ts`. Keep a type beside its sole consumer when moving it would make navigation worse.
- Put feature configuration and substantial static lookup data in `*.constants.ts`. A short constant used by one file stays local.
- Tests follow the same feature boundary: pure behavior gets unit tests; browser-visible wiring gets a small end-to-end regression. Split a large test file by product area only when fixture reuse remains clear.

## Size and review limits

| Size                  | Rule                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–200 lines           | Preferred for focused utilities, hooks and leaf components.                                                                                                               |
| 200–500 lines         | Healthy range for a cohesive feature module or component.                                                                                                                 |
| 501–1,000 lines       | Review for mixed responsibilities and churn; document why it remains cohesive if actively extended.                                                                       |
| More than 1,000 lines | Automatic refactoring candidate. Before adding another feature, extract the touched responsibility unless doing so would increase risk without one of the outcomes above. |

Generated code, schema/vendor snapshots and static catalogs may exceed these limits when splitting would harm traceability. Mark the reason near the file or in an ADR and keep generated/static files free of application logic.

## Dependency direction

Use this direction unless an ADR explicitly justifies an exception:

```text
page/application composition
        ↓
feature components and hooks
        ↓
pure feature services/utilities
        ↓
document/domain schema and boundary adapters
```

- Lower layers must not import page components.
- Pure modules must not read `window`, `document`, storage or network state.
- Browser hooks may depend on pure modules, but expose small values and commands instead of editor internals.
- Avoid catch-all `utils.ts`, `types.ts` or `constants.ts` files. Names must identify the feature, such as `block-links.ts` or `format-shortcuts.ts`.
- Prefer explicit named exports. Avoid barrel files until a directory has a stable public surface.

## Extraction checklist

Before moving code:

- Identify one responsibility and its callers.
- State which required outcome the extraction improves.
- Define the smallest explicit input/output or props contract.
- Capture current behavior with an existing or new focused test.
- Check that the move does not introduce a circular dependency or browser dependency into a pure module.

After moving code:

- Run formatting, lint and type checks.
- Run focused unit/component/browser tests for the boundary.
- Run `npm run check` before the branch is merged.
- Record exact results in [test results](test-results.md).
- Keep user data under `data/` untouched.

## 2026-09-16 baseline and priorities

The baseline measured 10,103 TypeScript/TSX lines. The automatic candidates are:

| File                          | Lines | Recent-change count | Decision                                                                                                                                          |
| ----------------------------- | ----: | ------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/e2e/workspace.spec.ts` | 2,144 |                  13 | Split by product feature after shared fixture helpers are isolated; this reduces review and merge conflicts without changing production behavior. |
| `apps/web/App.tsx`            | 1,847 |                   8 | Extract cohesive dialogs/sidebar and browser-routing or import/export responsibilities with explicit props/hooks.                                 |
| `apps/web/Editor.tsx`         | 1,695 |                   9 | Extract editor interaction hooks and leaf controls; prioritize behavior already backed by browser tests.                                          |

`packages/persistence/repository.ts` (472 lines), `packages/markdown/bundle.ts` (393) and `packages/markdown/convert.ts` (334) are within the healthy range and already have narrow responsibilities. They are not current refactoring targets.

For the first implementation slice, extract recently changed block selection/direct-link lifecycles from `Editor.tsx` and split their browser tests into a dedicated editor-interactions specification. These boundaries have direct isolated test seams, are a recurring source of changes, and can move without redesigning document persistence.

## Review questions

- Can the purpose of every new file be stated in one sentence?
- Is its public surface smaller than the implementation it replaced?
- Can its core behavior be tested without unrelated application setup?
- Will two developers changing different features edit fewer shared lines?
- Did the change preserve behavior and avoid a new abstraction layer with only one trivial call?

If the answers do not show tangible value, leave the cohesive code where it is and record the candidate as deferred.
