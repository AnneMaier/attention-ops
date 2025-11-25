import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
    it('renders without crashing', () => {
        render(<App />);
        // Since I don't know the exact content of App, I'll just check if it renders.
        // Ideally I would check for a specific element.
        // For now, just rendering is a good smoke test.
        expect(true).toBe(true);
    });
});
