# my-little-garden

## What it is ?

MyLittleGardn is an Application for desktop.  
It allows easily choose the plants you want, design the flowerbed and generate document realize your idea. (needed features will be added over time)

## How this project will help me?

You can create your own list of plants, easily find them to select the one you want for each flower bed.

In future version, you will be able to:

- save your selection
- design the flowerbed
- generate a plan and a list of plant to buy to make your project real

## how to use it?

TBC

## Need help?

TBD

## Local development tools

Install Node.js 24 and npm with Homebrew, then install the project dependencies
and run the test suite directly:

```bash
brew install node@24
npm install
npm test
```

Build and open the desktop application with:

```bash
npm start
```

Create distributable desktop artifacts for Linux, macOS, and Windows with:

```bash
npm run dist
```

Launch the isolated demo catalog, loaded from the bundled CSV on every run,
with:

```bash
npm run demo
```

The catalog database is created in Electron's application-data directory on
first launch. The catalog table reads that SQLite database in alphabetical
order and displays 25 plants per page.

The supported Node.js version is recorded in `package.json`. This branch uses
the native TypeScript 7 compiler and Oxlint's tsgo-powered type-aware rules;
their versions are recorded in `package.json` and `package-lock.json`.
The root `tsconfig.json` describes the workspace build graph, allowing
TypeScript to build independent projects concurrently and skip unchanged
projects on subsequent builds.

## Contributors

Marine DR  
Loic F.  
Florine J.
