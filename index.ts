// TODO:
// - Error handling
// - Reporting
// - Support done-callback
// - watcher integration

import path from 'path';
import yargs from 'yargs';
import glob from 'tiny-glob';

export type SyncTestFn = () => void;
export type AsyncTestFn = () => Promise<any>;
export type TestFn = SyncTestFn | AsyncTestFn;

type Test = {
  name: string;
  fn: TestFn;
  suite: Suite;
  only: boolean;
  skip: boolean;
};

type Suite = {
  name?: string;
  parent?: Suite;
  only: boolean;
  skip: boolean;
  contents: (Suite | Test)[];
  before: TestFn[];
  after: TestFn[];
  beforeEach: TestFn[];
  afterEach: TestFn[];
};

type RunSuiteOpts = {
  names: (string | undefined)[];
  beforeEach: TestFn[];
  afterEach: TestFn[];
};

type InternalState = {
  rootSuite: Suite;
  currentSuite: Suite;
  reporters: Reporter[];
};

type ReporterMessage = {};

interface Reporter {
  (message: ReporterMessage): void;
}

const defaultReporter: Reporter = () => {};

const createSuite = (): Suite => ({
  name: undefined,
  parent: undefined,
  only: false,
  skip: false,
  contents: [],
  before: [],
  after: [],
  beforeEach: [],
  afterEach: []
});

const createTest = (name: string, fn: TestFn, suite: Suite): Test => ({
  name,
  fn,
  suite,
  only: false,
  skip: false
});

const createState = (): InternalState => {
  const rootSuite = createSuite();
  return {
    rootSuite,
    currentSuite: rootSuite,
    reporters: [defaultReporter]
  };
};

const markAncestorsAndSelfOnly = (suite: Suite) => {
  let current: Suite | undefined = suite;
  while (current) {
    current.only = true;
    current = current.parent;
  }
};

const addTest = (name: string, fn: TestFn, only?: boolean, skip?: boolean): Test => {
  const test = createTest(name, fn, state.currentSuite);
  test.skip = !!skip;
  test.only = !!only;
  if (only) markAncestorsAndSelfOnly(test.suite);
  state.currentSuite.contents.push(test);
  return test;
};

const addSuite = (name: string, fn: Function, only?: boolean, skip?: boolean): Suite => {
  const prevSuite = state.currentSuite;
  const suite: Suite = createSuite();
  suite.name = name;
  suite.parent = state.currentSuite;
  suite.skip = !!skip;
  if (only) markAncestorsAndSelfOnly(suite);
  state.currentSuite.contents.push(suite);
  state.currentSuite = suite;
  fn();
  state.currentSuite = prevSuite;
  return suite;
};

let state: InternalState = createState();

export function describe(name: string, fn: Function) {
  addSuite(name, fn);
}

describe.skip = function skipDescribe(name: string, fn: Function) {
  addSuite(name, fn, false, true);
};

describe.only = function onlyDescribe(name: string, fn: Function) {
  addSuite(name, fn, true);
};

export function test(name: string, fn: TestFn) {
  addTest(name, fn);
}

test.skip = function skipTest(name: string, fn: TestFn) {
  addTest(name, fn, false, true);
};

test.only = function onlyTest(name: string, fn: TestFn) {
  addTest(name, fn, true, false);
};

export function before(fn: TestFn) {
  state.currentSuite.before.push(fn);
}

export function after(fn: TestFn) {
  state.currentSuite.after.push(fn);
}

export function beforeEach(fn: TestFn) {
  state.currentSuite.beforeEach.push(fn);
}

export function afterEach(fn: TestFn) {
  state.currentSuite.afterEach.push(fn);
}

export const suite = describe;
export const it = test;

const dispatchReporters = (message: ReporterMessage) => {
  state.reporters.forEach(reporter => reporter(message));
};

async function getFiles(globs: string[]) {
  const t1 = Date.now();
  const cwd = process.cwd();
  let files: string[] = [];
  for (const pattern of globs) {
    files = [...files, ...(await glob(pattern)).map(s => path.join(cwd, s))];
  }
  console.log(`Resolved globs in ${Date.now() - t1}ms`);
  return files;
}

async function collectTests(files: string[]) {
  const t1 = Date.now();
  files.forEach(s => require(s));
  console.log(`Loaded tests in ${Date.now() - t1}ms`);
}

async function runSuite(suite: Suite, opts: RunSuiteOpts) {
  const isTest = (o: Test | Suite): o is Test => !!(o as Test).fn;
  for await (const beforeSuite of suite.before) {
    try {
      await beforeSuite();
    } catch (e) {
      dispatchReporters({ type: 'beforeHookError' });
      throw e;
    }
  }
  const contentsHasOnly = suite.contents.some(content => content.only);
  for await (const content of suite.contents) {
    if (contentsHasOnly && !content.only) continue;
    if (content.skip) continue;
    const nextOpts: RunSuiteOpts = {
      names: [...opts.names, content.name],
      beforeEach: [...opts.beforeEach, ...suite.beforeEach],
      afterEach: [...opts.afterEach, ...suite.beforeEach]
    };
    if (isTest(content)) {
      for await (const beforeTest of nextOpts.beforeEach) {
        await beforeTest();
      }
      await content.fn();
      process.stdout.write('.');
      for await (const afterTest of nextOpts.afterEach) {
        await afterTest();
      }
    } else {
      await runSuite(content, nextOpts);
    }
  }
  for await (const afterSuite of suite.after) {
    await afterSuite();
  }
}

async function runAllTests() {
  var t1 = Date.now();
  await runSuite(state.rootSuite, {
    names: [],
    beforeEach: [],
    afterEach: []
  });
  console.log(`\nRan all tests in ${Date.now() - t1}ms`);
}

if (require.main === module) {
  (async () => {
    const { argv } = yargs.alias('r', 'require').alias('g', 'globals');

    if (argv.require) {
      const t1 = Date.now();
      String(argv.require)
        .split(',')
        .forEach(s => require(path.join(process.cwd(), s)));
      console.log(`Required ${argv.require} in ${Date.now() - t1}ms`);
    }

    if (argv.globals) {
      const globals = { describe, before, after, beforeEach, afterEach, test, it };
      Object.assign(globalThis, globals);
      console.log(`Exposed globals ${Object.keys(globals).join(',')}`);
    }

    state = createState();
    const files = await getFiles(argv._);
    await collectTests(files);
    await runAllTests();
  })();
}
