import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { App } from './App.js';

describe('application shell', () => {
  it('identifies the M0 foundation without claiming product functionality', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('M0 · Architecture and bootstrap');
    expect(markup).toContain('No engineering result is inferred by this shell.');
  });
});
