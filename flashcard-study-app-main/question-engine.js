/* Pure, dependency-free question rules, shared by the app and Node tests. */
(function (root) {
  'use strict';
  const textKey = c => c.d.normalize('NFKC').toLocaleLowerCase('de').replace(/\s+/g, ' ').trim();
  const overlaps = (a, b) => textKey(a) === textKey(b) || Boolean(a.group && b.group && a.group === b.group);
  function candidates(card, cards) {
    const seen = new Set([textKey(card)]);
    return cards.filter(other => {
      if (other.id === card.id || (card.criterion && other.criterion !== card.criterion) || overlaps(card, other)) return false;
      const key = textKey(other);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function boards(ids, cards, size) {
    const pending = ids.slice(), result = [];
    while (pending.length) {
      const board = [];
      for (let i = 0; i < pending.length && board.length < size;) {
        if (board.every(id => !overlaps(cards[id], cards[pending[i]]))) board.push(pending.splice(i, 1)[0]);
        else i++;
      }
      result.push(board);
    }
    return result;
  }
  const api = { textKey, overlaps, candidates, boards };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StudyQuestions = api;
})(typeof window !== 'undefined' ? window : globalThis);
