# GitHub Pages deployment

The marketing site is prepared for the repository Pages URL:

`https://jnx03.github.io/Flowtake/`

No repository setting, custom domain, or DNS change is performed by this configuration.

## Build modes

- `npm run dev` and `npm run build` use `/` as the asset base for normal local work.
- `npm run build -- --mode pages` uses `/Flowtake/`, matching GitHub project Pages.
- After a Pages-mode build, `npm run preview -- --mode pages` serves the generated site locally at `http://localhost:4173/Flowtake/` by default.

Public images used from React are joined to `import.meta.env.BASE_URL`. Vite rewrites the favicon and CSS font URLs during the Pages-mode build. This prevents requests from escaping to the domain root when the site is hosted below `/Flowtake/`.

## Prepared workflow

`.github/workflows/pages.yml` is manual-only. After the matching hardened GitHub Release is published, an administrator must dispatch the workflow from the `main` branch. The workflow rejects non-`main` dispatches, then confirms that GitHub's latest release matches the root package version and includes `SHA256SUMS.txt` before it builds `website/dist` or deploys to the `github-pages` environment.

The intended launch sequence is: merge the release commit to `main`, publish its matching release and checksums, then run **Deploy marketing site to GitHub Pages** from `main`. Repository pushes do not deploy the site automatically.

The build and deploy jobs are separated. The build job has read-only repository and Pages access; only the deploy job receives `pages: write` and `id-token: write`. Checkout does not persist credentials. All external actions are pinned to immutable commits:

| Action | Version | Commit |
| --- | --- | --- |
| `actions/checkout` | v7.0.0 | `9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0` |
| `actions/setup-node` | v6.4.0 | `48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e` |
| `actions/configure-pages` | v6.0.0 | `45bfe0192ca1faeb007ade9deae92b16b8254a0d` |
| `actions/upload-pages-artifact` | v5.0.0 | `fc324d3547104276b827a68afc52ff2a11cc49c9` |
| `actions/deploy-pages` | v5.0.0 | `cd2ce8fcbc39b97be8ca5fce6e763baed58fa128` |

Versions and commits were taken from the current official Vite GitHub Pages example on 2026-07-16.

## One-time repository setup

An administrator must explicitly choose **Settings -> Pages -> Build and deployment -> Source: GitHub Actions** before the first deployment. GitHub recommends protecting the `github-pages` environment so only `main` can deploy.

Do not add a `CNAME` file unless a custom domain has first been chosen and configured in repository settings. GitHub documents that a repository `CNAME` file alone does not configure the domain.

## References

- [Vite: Deploying a Static Site](https://vite.dev/guide/static-deploy.html#github-pages)
- [GitHub: Configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [GitHub: Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
