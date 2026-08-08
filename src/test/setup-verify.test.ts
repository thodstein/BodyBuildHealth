/**
 * Simple test to verify setup.ts is working
 */

import { describe, it, expect } from 'vitest';

describe('Setup verification', () => {
  it('should have window defined', () => {
    expect(window).toBeDefined();
  });
  
  it('should have localStorage mock', () => {
    expect(window.localStorage).toBeDefined();
    expect(typeof window.localStorage.getItem).toBe('function');
  });
  
  it('should have jest-dom matchers', () => {
    const div = document.createElement('div');
    div.textContent = 'test';
    document.body.appendChild(div);
    expect(div).toBeInTheDocument();
  });
});
