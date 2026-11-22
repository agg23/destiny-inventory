# vendor

Upstream code, as submodules, pristine. Nothing in here is ever edited.

| Submodule | Pinned | License |
|---|---|---|
| `DIM` | `dd9fc5d0` (2026-08-17) | MIT, see `DIM/LICENSE.md` |

### Why A Submodule Instead Of Copying?

The plan in `destiny-vault-manager.md` §5 said to copy the modules in. A submodule is
better. We get `git diff` against any upstream SHA for free, there's no question about what
we changed, and the MIT notice stays attached to the code it covers. The thing §5 was
warning against is a *merge relationship* with a repo that ships daily, and pinning a SHA
avoids that just as well as copying does. We update when we choose to.

### Then Where Do The Modifications Go?

`packages/dim-bridge`, as import redirects rather than edits. Nothing in the submodule is
touched.

Redirects are declared twice, and they have to stay in agreement:

- `tsconfig.base.json` paths, which tsc reads. These only match the aliased `app/foo` import
  form
- `dim-shims.mjs`, which the bundler reads. This matches on path suffix, so it also catches
  the relative form, and DIM reaches plenty of modules as `../utils/sentry` from inside the
  submodule

There's no way to derive either from the other, hence the duplication.

Five shims are needed, measured by bundling rather than by reading imports:

| Shim | Why |
|---|---|
| `app/store/types` | Describes DIM's redux store. Only ever used in type position |
| `app/i18next-t` | i18next translation. Returning the key is enough headless |
| `app/i18n` | Boots i18next and fetches a catalogue over HTTP |
| `app/utils/sentry` | Pulls the Sentry SDK, and an oauth module that reads `localStorage` at import time |
| `@sentry/browser`, `@sentry/react` | Stubbed at the package boundary |

`build-globals.mjs` covers a separate problem. DIM's source reads webpack DefinePlugin
globals like `$featureFlags` as free variables, so any bundle containing DIM code has to
inline them or it throws `ReferenceError` on import.

The payoff is that **no react, redux, or react-redux survives into the runtime bundle**.
The transitive import graph reaches all three across 232 files, but every one of those
reaches is type-only and erases at compile time. Reading the import graph overstates the
coupling badly; only bundling answers it.

If a file ever genuinely can't be handled by a redirect, it gets copied into
`packages/dim-bridge/src/patched/` with the MIT notice and a header naming its upstream path
and SHA. `store/override-sockets.ts` is the one known candidate, since it colocates a
`useState`/`useCallback` hook with pure logic, but the Phase 0 core doesn't import it.

### How Do I Update DIM?

```sh
cd vendor/DIM && git fetch && git checkout <sha>
```

Then diff the handful of files we depend on, fix the shims if their surface moved, and
update the table above. Game content is frozen, so upstream churn is mostly UI work that
doesn't concern us. There's no reason to do this often.
