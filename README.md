# SveltronKit

A minimal template for building Electron apps with SvelteKit.

It has native support for Typscript and doesn't use `electron-serve` in the production build.

Everything you can do in SvelteKit, you can do in SveltronKit; meaning that you can use component
libraries like [Shadcn-Svelte](https://next.shadcn-svelte.com/).

> [!IMPORTANT]
> This template uses SvelteKit's [hash router](https://svelte.dev/docs/kit/configuration#router) to
> create a single-page app. The only difference you'll have to look out for is to start all your routed
> links with `#/` instead of `/`.

## Dependencies & Frameworks

- [SvelteKit](https://kit.svelte.dev/)
- [Electron](https://www.electronjs.org/)
- [Electron Forge](https://www.electronforge.io/)
- [TypeScript](https://www.typescriptlang.org/)
- [TailwindCSS](https://tailwindcss.com/)

> [!NOTE]
> I've included TailwindCSS in this template because I use it in my own projects, but you can remove
> it easily if you don't want it.

## Getting Started

> [!WARNING]
> This project uses [`pnpm`](https://pnpm.io/) and uses [patching](https://pnpm.io/cli/patch) to work
> around some issues with SvelteKit. When this [PR](https://github.com/sveltejs/kit/pull/13812) merges,
> you can remove the patching and use the latest version of SvelteKit.

Start by installing the dependencies:

```
pnpm install
```

**Development:**

```
pnpm run start
```

[Electron Forge](https://www.electronforge.io/) with the [Vite plugin](https://www.electronforge.io/plugins/vite)
will take care of running the development server and building the app for you. You don't need to run
`vite dev` or `vite build` yourself. This also means that it supports hot module replacement (HMR).

**Production:**

```
pnpm run package
```

This will build the app and you can find the output in the `out` directory. You can run the production
app by opening the `.app` file in the `out` directory. This will not create your app's installer
for distribution though.

To create a distributable installer, you can use:

```
pnpm run make
```

This will create a distributable installer for your app. You can configure this in the `makers` section
in `forge.config.ts`. Reference the [makers documentation](https://www.electronforge.io/makers) for more
information.

# Electron Crash Course

I found that most of the problems I encountered when setting up Electron were because I didn't know
how Electron works and that the documentation was too dense to get up to speed with, so I'll include
a crash course here.
