/** Replace children without Element.replaceChildren (Chrome 86+). */
export function replaceElementChildren(element: Element, ...children: Node[]): void {
  while (element.firstChild) element.removeChild(element.firstChild);
  for (const child of children) element.appendChild(child);
}
