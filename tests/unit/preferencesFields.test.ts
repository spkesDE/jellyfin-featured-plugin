import { describe, expect, it, vi } from 'vitest';
import { createNumberField, createRangeField } from '../../src/preferencesFields';

describe('createNumberField', () => {
  it('keeps typing inside the field away from page-wide keyboard shortcuts', () => {
    const field = createNumberField('Weight', 25, 100);
    const input = field.querySelector<HTMLInputElement>('input')!;
    const pageKeydown = vi.fn();
    const pageKeypress = vi.fn();
    const pageKeyup = vi.fn();
    document.addEventListener('keydown', pageKeydown);
    document.addEventListener('keypress', pageKeypress);
    document.addEventListener('keyup', pageKeyup);
    document.body.appendChild(field);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: '7', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: '7', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: '7', bubbles: true }));

    expect(pageKeydown).not.toHaveBeenCalled();
    expect(pageKeypress).not.toHaveBeenCalled();
    expect(pageKeyup).not.toHaveBeenCalled();
    expect(input.value).toBe('25');
    expect(input.disabled).toBe(false);
    expect(input.readOnly).toBe(false);
  });
});

describe('createRangeField', () => {
  it('shows the current value and keeps arrow keys away from page-wide navigation', () => {
    const field = createRangeField('Trailer volume', 70, 100);
    const input = field.querySelector<HTMLInputElement>('input')!;
    const value = field.querySelector('output')!;
    const pageKeydown = vi.fn();
    document.addEventListener('keydown', pageKeydown);
    document.body.appendChild(field);

    expect(input.type).toBe('range');
    expect(value.textContent).toBe('70%');
    input.value = '35';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(value.textContent).toBe('35%');
    expect(input.getAttribute('aria-valuetext')).toBe('35%');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(pageKeydown).not.toHaveBeenCalled();
    document.removeEventListener('keydown', pageKeydown);
    field.remove();
  });
});
