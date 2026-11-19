import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Button } from './Button';
import { Section } from './Section';
import { Stepper } from './Stepper';
import { Switch } from './Switch';

afterEach(cleanup);
test('button and section expose their accessible names and disabled behavior', () => {
  const click = vi.fn();
  render(
    <Section title="Entrants">
      <Button disabled onClick={click}>
        Clear
      </Button>
    </Section>,
  );
  expect(screen.getByRole('region', { name: 'Entrants' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  expect(click).not.toHaveBeenCalled();
});
test('switch has a native keyboard-operable checkbox and toggles', () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <Switch label="Remove duplicates" checked={false} onChange={onChange} />,
  );
  const control = screen.getByRole('switch', { name: 'Remove duplicates' });
  expect(control.getAttribute('type')).toBe('checkbox');
  fireEvent.click(control);
  expect(onChange).toHaveBeenCalledWith(true);
  rerender(
    <Switch
      label="Remove duplicates"
      checked
      onChange={onChange}
      disabled
      describedBy="reason"
    />,
  );
  expect((control as HTMLInputElement).disabled).toBe(true);
  expect(control.getAttribute('aria-describedby')).toBe('reason');
});
test.each([
  [1, 1, 4, true, false],
  [4, 1, 4, false, true],
  [0, 0, 0, true, true],
] as const)(
  'stepper bounds at %i',
  (value, min, max, lowerDisabled, upperDisabled) => {
    const change = vi.fn();
    render(
      <Stepper
        label="Winners"
        value={value}
        min={min}
        max={max}
        onChange={change}
      />,
    );
    const lower = screen.getByRole('button', {
      name: 'Decrease winners',
    }) as HTMLButtonElement;
    const upper = screen.getByRole('button', {
      name: 'Increase winners',
    }) as HTMLButtonElement;
    expect(lower.disabled).toBe(lowerDisabled);
    expect(upper.disabled).toBe(upperDisabled);
    const field = screen.getByRole('spinbutton', { name: 'Winners' });
    expect(field.getAttribute('min')).toBe(String(min));
    expect(field.getAttribute('max')).toBe(String(max));
    fireEvent.change(field, { target: { value: '2' } });
    expect(change).toHaveBeenCalledWith(2);
  },
);
