(() => {
  const words = [
    { english: 'deadline', vietnamese: 'hạn chót', group: 'work', groupName: 'TOEIC Công việc', urgency: 'urgent', risk: 86, reason: '5 ngày từ lần ôn gần nhất', next: 'Hôm nay', interval: 'Quá hạn 2 ngày' },
    { english: 'negotiate', vietnamese: 'đàm phán', group: 'work', groupName: 'TOEIC Công việc', urgency: 'urgent', risk: 79, reason: 'Từng trả lời sai 2 lần', next: 'Hôm nay', interval: 'Đang đến lượt' },
    { english: 'accomplish', vietnamese: 'hoàn thành', group: 'work', groupName: 'TOEIC Công việc', urgency: 'urgent', risk: 73, reason: 'Dễ quên sau phiên gần đây', next: 'Hôm nay', interval: 'Đang đến lượt' },
    { english: 'agenda', vietnamese: 'chương trình họp', group: 'work', groupName: 'TOEIC Công việc', urgency: 'high', risk: 62, reason: 'Đã 3 ngày chưa gặp lại', next: 'Ngày mai', interval: 'Còn 1 ngày' },
    { english: 'catch up', vietnamese: 'bắt kịp, cập nhật', group: 'daily', groupName: 'Giao tiếp hằng ngày', urgency: 'high', risk: 55, reason: 'Mức ghi nhớ còn thấp', next: 'Ngày mai', interval: 'Còn 1 ngày' },
    { english: 'get along', vietnamese: 'hòa hợp', group: 'daily', groupName: 'Giao tiếp hằng ngày', urgency: 'stable', risk: 28, reason: 'Ghi nhớ khá vững', next: 'Sau 4 ngày', interval: 'Chưa đến lượt' },
    { english: 'itinerary', vietnamese: 'lịch trình', group: 'travel', groupName: 'Du lịch', urgency: 'stable', risk: 24, reason: 'Đã ôn đúng gần đây', next: 'Sau 5 ngày', interval: 'Chưa đến lượt' },
    { english: 'accommodation', vietnamese: 'chỗ ở', group: 'travel', groupName: 'Du lịch', urgency: 'stable', risk: 18, reason: 'Ghi nhớ khá vững', next: 'Sau 7 ngày', interval: 'Chưa đến lượt' },
    { english: 'proposal', vietnamese: 'đề xuất', group: 'work', groupName: 'TOEIC Công việc', urgency: 'urgent', risk: 71, reason: 'Đang đến lượt ôn', next: 'Hôm nay', interval: 'Đang đến lượt' },
    { english: 'follow up', vietnamese: 'theo dõi tiếp', group: 'daily', groupName: 'Giao tiếp hằng ngày', urgency: 'high', risk: 48, reason: 'Sắp đến lượt ôn', next: 'Ngày mai', interval: 'Còn 1 ngày' },
    { english: 'boarding pass', vietnamese: 'thẻ lên máy bay', group: 'travel', groupName: 'Du lịch', urgency: 'stable', risk: 21, reason: 'Chưa đến lượt ôn', next: 'Sau 6 ngày', interval: 'Chưa đến lượt' },
    { english: 'reservation', vietnamese: 'sự đặt chỗ', group: 'travel', groupName: 'Du lịch', urgency: 'stable', risk: 15, reason: 'Chưa đến lượt ôn', next: 'Sau 8 ngày', interval: 'Chưa đến lượt' }
  ];
  const labels = { urgent: 'Cấp tốc', high: 'Ưu tiên', stable: 'Ổn định' };
  const list = document.getElementById('wordList');
  const empty = document.getElementById('emptyState');
  const count = document.getElementById('resultCount');
  const pagination = document.getElementById('pagination');
  const group = document.getElementById('groupFilter');
  const search = document.getElementById('wordSearch');
  const tabs = [...document.querySelectorAll('.priority')];
  const dialog = document.getElementById('wordFlashcard');
  const flipCard = document.getElementById('flipCard');
  const cardWord = document.getElementById('cardWord');
  const cardSide = document.getElementById('cardSide');
  const cardHint = document.getElementById('cardHint');
  const cardGroup = document.getElementById('cardGroup');
  let priority = 'all';
  let currentPage = 1;
  const pageSize = 10;
  let searchTerm = '';
  let toastTimer;
  let selectedWord = null;
  let flipped = false;

  function normalize(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi-VN');
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
  }

  function render() {
    const query = normalize(searchTerm);
    const visible = words.filter(word =>
      (group.value === 'all' || word.group === group.value) &&
      (priority === 'all' || word.urgency === priority) &&
      (!query || normalize(word.english).includes(query) || normalize(word.vietnamese).includes(query))
    ).sort((a, b) => ({ urgent: 0, high: 1, stable: 2 })[a.urgency] - ({ urgent: 0, high: 1, stable: 2 })[b.urgency]);
    const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const pageWords = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    list.innerHTML = pageWords.map(word => `
      <button class="word-row ${word.urgency}" type="button" data-word-index="${words.indexOf(word)}" aria-label="Mở flashcard cho từ ${word.english}">
        <div class="word-main"><strong>${word.english}</strong><span class="meaning">${word.vietnamese}</span><div class="word-tags"><span class="urgency-tag">${labels[word.urgency]}</span><span class="group-tag">${word.groupName}</span></div></div>
        <div class="risk"><b>${word.risk}%</b><small>Nguy cơ quên ước tính</small><div class="risk-bar"><i style="width:${word.risk}%"></i></div></div>
        <div class="next"><b>${word.next}</b><small>${word.interval}</small></div>
      </button>`).join('');
    empty.hidden = visible.length !== 0;
    count.textContent = `${visible.length} từ`;
    pagination.hidden = totalPages === 1;
    pagination.innerHTML = totalPages === 1 ? '' : `
      <button type="button" data-page="previous" ${currentPage === 1 ? 'disabled' : ''}>← Trước</button>
      ${Array.from({ length: totalPages }, (_, index) => `<button type="button" data-page="${index + 1}" class="${currentPage === index + 1 ? 'active' : ''}" ${currentPage === index + 1 ? 'aria-current="page"' : ''}>${index + 1}</button>`).join('')}
      <button type="button" data-page="next" ${currentPage === totalPages ? 'disabled' : ''}>Sau →</button>`;
  }

  tabs.forEach(tab => tab.addEventListener('click', () => {
    priority = tab.dataset.priority;
    currentPage = 1;
    tabs.forEach(item => item.classList.toggle('active', item === tab));
    render();
  }));
  group.addEventListener('change', () => { currentPage = 1; render(); });
  function applySearch() {
    searchTerm = search.value.trim();
    currentPage = 1;
    render();
  }
  search.addEventListener('keydown', event => { if (event.key === 'Enter') applySearch(); });
  search.addEventListener('input', () => { if (!search.value.trim()) applySearch(); });
  document.getElementById('searchButton').addEventListener('click', applySearch);
  pagination.addEventListener('click', event => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    currentPage = button.dataset.page === 'previous' ? currentPage - 1 : button.dataset.page === 'next' ? currentPage + 1 : Number(button.dataset.page);
    render();
    document.getElementById('wordList').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  list.addEventListener('click', event => {
    const row = event.target.closest('[data-word-index]');
    if (!row) return;
    selectedWord = words[Number(row.dataset.wordIndex)];
    flipped = false;
    updateCard();
    dialog.showModal();
  });
  function updateCard() {
    if (!selectedWord) return;
    cardWord.textContent = flipped ? selectedWord.vietnamese : selectedWord.english;
    cardSide.textContent = flipped ? 'MẶT SAU · NGHĨA TIẾNG VIỆT' : 'MẶT TRƯỚC · TIẾNG ANH';
    cardHint.textContent = flipped ? 'Chạm để xem từ tiếng Anh ↶' : 'Chạm để xem nghĩa ↗';
    cardGroup.textContent = selectedWord.groupName;
    flipCard.classList.toggle('flipped', flipped);
    document.getElementById('nextCard').textContent = flipped ? 'Xem từ ↶' : 'Lật thẻ ↗';
  }
  function flip() { flipped = !flipped; updateCard(); }
  flipCard.addEventListener('click', flip);
  document.getElementById('nextCard').addEventListener('click', flip);
  document.getElementById('closeFlashcard').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.getElementById('createGroup').addEventListener('click', () => showToast('Bản xem trước chỉ minh họa. Trong ứng dụng, thao tác này tạo nhóm mới cho các từ cấp tốc và ưu tiên.'));
  render();
})();
