// Step 1. collect CLI options
// - parse -r/--require: require directly here
// - collect globs from CLI

// Step 2. collect suites, tests and hooks
// use globs from CLI to get all files
// for each file: require and build up internal data structure

// Step 3. run tests or watch and log output through reporters
// Run all tests, collect the results and pass through reporters

// Step 4. if watching and file changes: clear all caches and start at Step 2

if (require.main === module) {
  // processCliOptions();
  // collectTests();
  // runTests(); || watchTests();
}
