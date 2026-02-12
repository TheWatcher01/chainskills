import { defineBuildConfig } from 'obuild';

export default defineBuildConfig({
  entries: [
    { input: 'src/index.ts', name: 'index' },
    { input: 'src/cli/index.ts', name: 'cli' },
    { input: 'src/adapters/parser/markdown-parser.ts', name: 'parser' },
    { input: 'src/adapters/executor/simple-executor.ts', name: 'runtime' },
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: false,
  },
});
