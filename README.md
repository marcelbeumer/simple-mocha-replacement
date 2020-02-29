# simple-mocha-replacement
Experimental test runner that aims to be a modern, fast and stable mocha replacement.

**WORK IN PROGRESS: nothing usable yet**

## Goals

- Small and simple: if possible single TS file implementation
- Make it fast: require cache manipulation and chokidar for fs watching
- Make it stable: quick changes in watch mode should not break the runner
- No globals: import test, describe, it, etc
- Drop-in replacement for mocha: expose some globals and run mocha test suites as-is
