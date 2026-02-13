import { defineBuildConfig } from 'obuild/config';

export default defineBuildConfig({
  entries: [
    { type: 'bundle', input: 'src/index.ts', dts: true },
    { type: 'bundle', input: 'src/cli/index.ts', dts: false },
    { type: 'bundle', input: 'src/adapters/parser/markdown-parser.ts', dts: true },
    { type: 'bundle', input: 'src/adapters/executor/simple-executor.ts', dts: true },
  ],
});
