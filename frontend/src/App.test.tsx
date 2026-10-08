import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { App } from './App.js';

describe('application shell', () => {
  it('identifies the M1 foundation without claiming product functionality', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('M1 · Contract and validation foundation');
    expect(markup).toContain('No engineering result is inferred by this shell.');
  });
});
