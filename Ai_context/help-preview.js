(() => {
  const topics = [
    { id: 'start', symbol: '↗', label: 'Bắt đầu', tag: 'KHỞI ĐẦU', intro: 'Ba việc cần làm để có buổi học đầu tiên.', questions: [
      { title: 'Có cần kết nối cơ sở dữ liệu trước khi học?', answer: '<p>Không. Lexforge hiện dùng SQLite cục bộ; bạn có thể bắt đầu bằng cách tạo nhóm từ và thêm từ vựng.</p><p><a href="groups-preview.html">Mở Nhóm từ ↗</a></p>' },
      { title: 'Tôi nên bắt đầu từ đâu?', answer: '<p>Tạo một nhóm theo chủ đề, thêm vài từ tiếng Anh và nghĩa tiếng Việt, rồi mở Flashcard để ôn. Sau buổi học, xem kết quả ở Tiến độ học.</p><p><a href="vocabulary-preview.html">Mở Từ vựng ↗</a> · <a href="flashcard-preview.html">Mở Flashcard ↗</a></p>' },
      { title: 'Chưa có từ nào đến hạn thì làm gì?', answer: '<p>Bạn có thể chọn học theo nhóm hoặc toàn bộ thư viện trong Flashcard, hoặc thêm từ mới trước khi bắt đầu.</p>' }
    ] },
    { id: 'vocabulary', symbol: '▤', label: 'Từ vựng & Excel', tag: 'THƯ VIỆN CÁ NHÂN', intro: 'Tạo, nhập và quản lý danh sách từ của bạn.', questions: [
      { title: 'Thêm từ mới như thế nào?', answer: '<p>Trong trang Từ vựng, chọn Thêm từ, nhập từ tiếng Anh và nghĩa tiếng Việt, rồi chọn nhóm. Phiên âm và ví dụ có thể bổ sung sau.</p><p><a href="vocabulary-preview.html">Mở Từ vựng ↗</a></p>' },
      { title: 'File Excel cần những cột nào?', answer: '<p>Ứng dụng nhận file <b>.xlsx</b> hoặc <b>.csv</b>. Hai cột bắt buộc là <b>English</b> và <b>Vietnamese</b>. Có thể thêm <b>Pronunciation</b>, <b>PartOfSpeech</b>, <b>Example</b> và <b>ExampleVi</b>.</p>' },
      { title: 'Từ nhập từ Excel đi vào nhóm nào?', answer: '<p>Sau khi chọn file, bạn có thể chọn một nhóm đang có hoặc tạo nhóm mới ngay trong bước nhập.</p><p><a href="groups-preview.html">Mở Nhóm từ ↗</a></p>' },
      { title: 'Có xuất danh sách từ được không?', answer: '<p>Có. Dùng nút Xuất danh sách trong trang Từ vựng. Bạn có thể lọc theo nhóm trước khi xuất.</p>' }
    ] },
    { id: 'review', symbol: '◷', label: 'Ôn tập', tag: 'GHI NHỚ LÂU DÀI', intro: 'Học bằng Flashcard và xem từ nào cần quay lại.', questions: [
      { title: 'Flashcard hoạt động như thế nào?', answer: '<p>Chọn tập từ, bắt đầu học, bấm vào thẻ để lật xem nghĩa rồi tự đánh giá Đã thuộc hoặc Chưa thuộc. Ứng dụng ghi lại kết quả để tính lần ôn tiếp theo.</p><p><a href="flashcard-preview.html">Mở Flashcard ↗</a></p>' },
      { title: 'Lịch ôn tập AI ưu tiên từ ra sao?', answer: '<p>Trang Lịch ôn xếp từ theo Cấp tốc, Ưu tiên và Ổn định. Bấm một từ để mở Flashcard của từ đó. Khi dịch vụ LSTM không sẵn sàng, ứng dụng có cách tính dự phòng cục bộ.</p><p><a href="schedule-preview.html">Mở Lịch ôn ↗</a></p>' },
      { title: 'Tôi xem tiến độ học ở đâu?', answer: '<p>Trang Tiến độ học có tổng quan, mức độ ghi nhớ của từ, thành tích trò chơi và thói quen học gần đây.</p><p><a href="progress-preview.html">Mở Tiến độ học ↗</a></p>' }
    ] },
    { id: 'ai', symbol: '✦', label: 'AI & MP3', tag: 'CÔNG CỤ THÔNG MINH', intro: 'Chuẩn bị Groq key cho những tính năng cần AI.', questions: [
      { title: 'Khi nào tôi cần Groq API key?', answer: '<p>Groq key cần cho AI Coach, tra cứu hoặc tạo từ bằng AI và bài luyện nghe MP3. Nhập key trong Cài đặt rồi lưu.</p><p><a href="settings-preview.html">Mở Cài đặt ↗</a></p>' },
      { title: 'AI Coach giúp luyện gì?', answer: '<p>AI Coach có các chế độ luyện hội thoại, viết và nói. Bạn có thể chọn nhóm từ làm ngữ cảnh trước khi bắt đầu.</p><p><a href="ai-coach-preview.html">Mở AI Coach ↗</a></p>' },
      { title: 'Học nghe MP3 cần chuẩn bị gì?', answer: '<p>Chọn file <b>.mp3</b>, kết nối Internet và Groq key. Ứng dụng dùng âm thanh để tạo nội dung và câu hỏi luyện nghe.</p><p><a href="listening-preview.html">Mở Học nghe MP3 ↗</a></p>' }
    ] },
    { id: 'games', symbol: '⌘', label: 'Trò chơi', tag: 'LUYỆN QUA THỬ THÁCH', intro: 'Dùng từ đã học trong các ván chơi ngắn.', questions: [
      { title: 'Có những trò chơi nào?', answer: '<p>Lexforge có Gõ chữ tốc độ, Đánh quái, Zombie Survival, Memory Flip và các trò chơi Multiplayer. Hãy ôn một nhóm từ trước để vào ván dễ hơn.</p><p><a href="typing-preview.html">Xem Gõ chữ tốc độ ↗</a> · <a href="memory-preview.html">Xem Memory Flip ↗</a></p>' },
      { title: 'Multiplayer cần gì để chơi với bạn bè?', answer: '<p>Cần một game server có thể truy cập từ máy của những người chơi. Sau khi kết nối, bạn có thể tạo phòng hoặc vào phòng bằng mã.</p><p><a href="multiplayer-preview.html">Mở Multiplayer ↗</a></p>' },
      { title: 'Gõ chữ tốc độ xác nhận câu trả lời thế nào?', answer: '<p>Nhập từ tương ứng rồi nhấn <kbd>Enter</kbd>. Bạn có thể chọn chiều gõ trước khi bắt đầu ván.</p>' }
    ] },
    { id: 'data', symbol: '◫', label: 'Dữ liệu & phím', tag: 'QUẢN LÝ ỨNG DỤNG', intro: 'Hiểu dữ liệu đang ở đâu và dùng những thao tác nhanh đã có.', questions: [
      { title: 'Dữ liệu học lưu ở đâu?', answer: '<p>Từ vựng, nhóm và kết quả học được lưu cục bộ bằng SQLite trên máy của bạn. Cài đặt cho biết số lượng dữ liệu hiện có và cung cấp thao tác xóa khi cần.</p><p><a href="settings-preview.html">Mở Cài đặt ↗</a></p>' },
      { title: 'Có những phím tắt nào?', answer: '<p>Trong biểu mẫu thêm từ: <kbd>Ctrl+Enter</kbd> để lưu và <kbd>Ctrl+S</kbd> để phát âm từ đang nhập. Trong Gõ chữ tốc độ: <kbd>Enter</kbd> để gửi câu trả lời.</p>' },
      { title: 'Nếu xóa lịch sử học thì từ vựng có mất không?', answer: '<p>Không. Xóa lịch sử học chỉ xóa phiên học và điểm game. Tác vụ Xóa toàn bộ mới xóa cả từ vựng và nhóm; hãy đọc kỹ xác nhận trước khi tiếp tục.</p>' }
    ] }
  ];

  const nav = document.getElementById('topicNav');
  const list = document.getElementById('questionList');
  const search = document.getElementById('helpSearch');
  const empty = document.getElementById('searchEmpty');
  const count = document.getElementById('guideCount');
  let active = 'start';
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi-VN');
  const pageSearch = document.getElementById('pageSearch');
  const pageResults = document.getElementById('pageResults');
  const pages = [
    ['Tổng quan', 'dashboard-preview.html'],
    ['Từ vựng', 'vocabulary-preview.html'],
    ['Nhóm từ', 'groups-preview.html'],
    ['Flashcard', 'flashcard-preview.html'],
    ['AI Coach', 'ai-coach-preview.html'],
    ['Học nghe MP3', 'listening-preview.html'],
    ['Gõ chữ tốc độ', 'typing-preview.html'],
    ['Đánh quái', 'monster-preview.html'],
    ['Zombie', 'zombie-preview.html'],
    ['Memory Flip', 'memory-preview.html'],
    ['Multiplayer', 'multiplayer-preview.html'],
    ['Tiến độ học', 'progress-preview.html'],
    ['Lịch ôn', 'schedule-preview.html'],
    ['Cài đặt', 'settings-preview.html'],
    ['Hướng dẫn', 'help-preview.html']
  ];
  function renderPageResults() {
    const query = normalize(pageSearch.value.trim());
    if (!query) {
      pageResults.hidden = true;
      pageResults.replaceChildren();
      return;
    }
    const matches = pages.filter(([title]) => normalize(title).includes(query)).slice(0, 6);
    pageResults.replaceChildren();
    if (matches.length) {
      matches.forEach(([title, href]) => {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = title;
        pageResults.appendChild(link);
      });
    } else {
      const message = document.createElement('p');
      message.textContent = 'Không tìm thấy trang phù hợp.';
      pageResults.appendChild(message);
    }
    pageResults.hidden = false;
  }

  function renderNav() {
    nav.innerHTML = topics.map(topic => `<button type="button" data-topic="${topic.id}" class="${topic.id === active && !search.value ? 'active' : ''}"><i>${topic.symbol}</i>${topic.label}</button>`).join('');
  }
  function renderQuestions(items) {
    list.innerHTML = items.map((item, index) => `<details class="question" ${index === 0 ? 'open' : ''}><summary>${item.title}</summary><div class="answer">${item.answer}</div></details>`).join('');
    empty.hidden = items.length > 0;
  }
  function render() {
    const query = normalize(search.value.trim());
    if (query) {
      const matches = topics.flatMap(topic => topic.questions.filter(item => normalize(`${topic.label} ${item.title} ${item.answer.replace(/<[^>]+>/g, ' ')}`).includes(query)));
      document.getElementById('topicSymbol').textContent = '⌕';
      document.getElementById('topicTag').textContent = 'KẾT QUẢ TÌM KIẾM';
      document.getElementById('topicTitle').textContent = 'Hướng dẫn phù hợp';
      document.getElementById('topicIntro').textContent = matches.length ? `Có ${matches.length} câu trả lời liên quan đến từ khóa của bạn.` : '';
      count.textContent = `${matches.length} kết quả`;
      renderQuestions(matches);
    } else {
      const topic = topics.find(item => item.id === active);
      document.getElementById('topicSymbol').textContent = topic.symbol;
      document.getElementById('topicTag').textContent = topic.tag;
      document.getElementById('topicTitle').textContent = topic.label;
      document.getElementById('topicIntro').textContent = topic.intro;
      count.textContent = `${topics.length} chủ đề`;
      renderQuestions(topic.questions);
    }
    renderNav();
  }
  nav.addEventListener('click', event => {
    const button = event.target.closest('[data-topic]');
    if (!button) return;
    active = button.dataset.topic;
    search.value = '';
    render();
  });
  search.addEventListener('input', render);
  pageSearch.addEventListener('input', renderPageResults);
  pageSearch.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      const first = pageResults.querySelector('a');
      if (first) window.location.href = first.href;
    } else if (event.key === 'Escape') {
      pageSearch.value = '';
      pageResults.hidden = true;
      pageSearch.blur();
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.global-finder')) pageResults.hidden = true;
  });
  document.getElementById('themeToggle').addEventListener('click', event => {
    const dark = document.body.classList.toggle('dark');
    event.currentTarget.setAttribute('aria-pressed', String(dark));
    event.currentTarget.textContent = dark ? '☀' : '◐';
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      pageSearch.focus();
      pageSearch.select();
      return;
    }
    if (event.key === '/' && document.activeElement !== search && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      search.focus();
    } else if (event.key === 'Escape' && document.activeElement === search) {
      search.value = '';
      search.blur();
      render();
    }
  });
  render();
})();
