export function createTextElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  text: string,
  className?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

export function createPreferenceFieldset(title: string, help?: string, className?: string): HTMLFieldSetElement {
  const fieldset = document.createElement('fieldset');
  if (className) fieldset.className = className;
  fieldset.appendChild(createTextElement('legend', title));
  if (help) fieldset.appendChild(createTextElement('p', help, `${className ?? 'ec-preference'}-help`));
  return fieldset;
}

export function createMaterialIcon(name: string): HTMLSpanElement {
  const icon = createTextElement('span', name, 'material-icons');
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}
