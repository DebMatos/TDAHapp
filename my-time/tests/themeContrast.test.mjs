import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../src/theme/colors.js', import.meta.url), 'utf8');
const { lightColors, darkColors } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const luminance = hex => {
  const values = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
};
const contrast = (foreground, background) => {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

test('light: canvas tokens use the temporary warm palette', () => {
  assert.equal(lightColors.background, '#EAE7E1');
  assert.equal(lightColors.surface, '#F5F2ED');
});

test('light: tracking control icons meet non-text contrast', () => {
  assert.ok(contrast(lightColors.onAction, lightColors.danger) >= 3);
  assert.ok(contrast(lightColors.text, lightColors.completed) >= 3);
});
for (const [theme, colors] of [['light', lightColors], ['dark', darkColors]]) {
  test(`${theme}: authentication focus border is visible on the input surface`, () => {
    assert.ok(contrast(colors.selection, colors.input) >= 3,
      `${colors.selection} on ${colors.input}`);
  });
  test(`${theme}: notification switch thumb is distinct in both states`, () => {
    assert.ok(contrast(colors.selection, colors.selectionSoft) >= 3,
      `${colors.selection} on ${colors.selectionSoft}`);
    assert.ok(contrast(colors.textMuted, colors.surfaceMuted) >= 3,
      `${colors.textMuted} on ${colors.surfaceMuted}`);
  });
  test(`${theme}: action labels, selected day and Quick Create meet small-text contrast`, () => {
    for (const [text, background] of [[colors.onAction, colors.action], [colors.onAction, colors.selection], [colors.surface, colors.selection]]) {
      assert.ok(contrast(text, background) >= 4.5, `${text} on ${background}`);
    }
  });
  test(`${theme}: secondary selection, muted text, placeholders and save action are legible`, () => {
    for (const [text, background] of [[colors.selectionText, colors.selectionSoft], [colors.textMuted, colors.surface], [colors.placeholder, colors.input], [colors.saveAction, colors.surface], [colors.selectionIndicator, colors.surfaceMuted]]) {
      assert.ok(contrast(text, background) >= 4.5, `${text} on ${background}`);
    }
  });
  test(`${theme}: active countdown text is legible on the honey label`, () => {
    assert.ok(contrast(colors.onNow, colors.now) >= 4.5, `${colors.onNow} on ${colors.now}`);
  });
}
