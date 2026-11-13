import tseslint from 'typescript-eslint';

const revealRestrictedLayers = ['ui', 'store', 'db', 'io'];
const engineRestrictedLayers = [...revealRestrictedLayers, 'reveal', 'dev'];

function restrictLayerImports(layers, packages = []) {
  const appLayers = layers.join('|');
  const patterns = [
    {
      regex: `^(?:@/|(?:\\.\\.?/)+(?:src/)?)(?:${appLayers})(?:/|$)`,
      message: 'This layer cannot import from that application directory.',
    },
  ];

  if (packages.length > 0) {
    patterns.push({
      regex: `^(?:${packages.join('|')})(?:/|$)`,
      message: 'The engine cannot depend on UI or persistence packages.',
    });
  }

  return ['error', { patterns }];
}

export default [
  { ignores: ['dist/**', 'coverage/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the engine RNG or the reveal cosmetic wrapper.',
        },
      ],
    },
  },
  {
    files: ['src/engine/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictLayerImports(engineRestrictedLayers, [
        'react',
        'react-dom',
        'dexie',
        'zustand',
      ]),
      'no-restricted-globals': [
        'error',
        {
          globals: ['window', 'document', 'localStorage', 'sessionStorage'],
          checkGlobalObject: true,
        },
      ],
    },
  },
  {
    files: ['src/reveal/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictLayerImports(revealRestrictedLayers),
    },
  },
];
