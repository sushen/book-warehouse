// Typographic cover artwork: presentation only, never a claimed original cover.
export function catalogueCard({ id, title, author, format, language, location = '', description = '', status, available = true }) {
  const node = (tag, text, className = '') => {
    const el = document.createElement(tag); el.textContent = text; el.className = className; return el;
  };
  const tone = [...String(id)].reduce((sum, char) => sum + char.codePointAt(0), 0) % 4;
  const card = node('article', '', 'book-card catalogue-book');
  const cover = node('div', '', `book-cover cover-${tone}`); cover.setAttribute('aria-hidden', 'true');
  cover.append(node('span', 'BOOK WAREHOUSE', 'cover-small'), node('span', title, 'cover-title'), node('span', format, 'cover-small'));
  const body = node('div', '', 'book-body');
  body.append(node('p', [format, language].filter(Boolean).join(' · '), 'book-category'), node('h3', title), node('p', author, 'book-author'));
  if (location) body.append(node('p', location, 'book-location'));
  if (description) body.append(node('p', description, 'catalogue-description'));
  const foot = node('div', '', 'book-foot');
  foot.append(node('span', status, `availability ${available ? 'available' : 'unavailable'}`));
  body.append(foot); card.append(cover, body);
  return { card, foot };
}
