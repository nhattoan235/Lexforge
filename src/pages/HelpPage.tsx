import React, { useMemo, useState } from 'react';
import { BookOpen, Layers, Search, Sparkles, ArrowUpRight, ChevronDown, CalendarDays } from 'lucide-react';
import { useApp } from '../App';
import './HelpPage.css';

const topics = [
  { id: 'start', title: 'Bắt đầu', icon: '✦', intro: 'Ba bước đầu tiên để xây dựng thư viện từ của riêng bạn.', questions: [
    ['Tôi nên bắt đầu từ đâu?', 'Tạo một nhóm từ theo chủ đề, thêm từ vựng vào nhóm đó, rồi mở Flashcard để bắt đầu ôn. Dashboard sẽ cho bạn biết bước tiếp theo mỗi ngày.'],
    ['Dữ liệu học của tôi được lưu ở đâu?', 'Dữ liệu được lưu trong cơ sở dữ liệu SQLite trên máy của bạn.'] ] },
  { id: 'words', title: 'Từ vựng & Excel', icon: '▤', intro: 'Tạo nhóm, thêm từ và quản lý thư viện từ vựng.', questions: [
    ['Làm thế nào để thêm từ?', 'Mở trang Từ vựng, chọn thêm từ, điền từ tiếng Anh và nghĩa tiếng Việt, rồi chọn nhóm phù hợp.'],
    ['Có thể nhập danh sách từ từ Excel không?', 'Có. Trong trang Từ vựng, dùng chức năng nhập Excel để đưa nhiều từ vào thư viện cùng lúc.'],
    ['Làm sao tìm một từ đã lưu?', 'Dùng ô tìm kiếm ở trang Từ vựng; bạn cũng có thể lọc theo nhóm.'] ] },
  { id: 'review', title: 'Flashcard & lịch ôn', icon: '◇', intro: 'Ôn đúng lúc và theo dõi những từ cần chú ý.', questions: [
    ['Flashcard hoạt động thế nào?', 'Chọn bộ từ cần ôn, lật thẻ để xem nghĩa, rồi tự đánh giá mức độ nhớ của mình. Kết quả sẽ được ghi vào lịch học.'],
    ['Lịch ôn cho biết điều gì?', 'Lịch ôn ưu tiên các từ có nguy cơ quên cao và những từ sắp đến lượt. Chọn một từ để mở Flashcard.'],
    ['Tôi có thể ôn một nhóm riêng không?', 'Có. Bạn có thể chọn nhóm trong trang Flashcard trước khi bắt đầu.'] ] },
  { id: 'ai', title: 'AI Coach & nghe', icon: '✧', intro: 'Thực hành với trợ lý AI và luyện khả năng nghe.', questions: [
    ['AI Coach dùng để làm gì?', 'AI Coach giúp bạn luyện tập và nhận phản hồi trong quá trình học từ vựng. Một số tính năng cần cấu hình khóa Groq trong Cài đặt.'],
    ['Tôi luyện nghe ở đâu?', 'Mở Học nghe MP3 từ thanh điều hướng để chọn bài nghe và luyện tập.'] ] },
  { id: 'games', title: 'Trò chơi', icon: '✳', intro: 'Đổi nhịp học bằng các trò chơi từ vựng.', questions: [
    ['Điểm game được tính như thế nào?', 'Các trò chơi ghi nhận kết quả của từng lượt. Bạn có thể xem tổng điểm tại trang Tiến độ và Cài đặt.'],
    ['Tôi có thể chơi cùng người khác không?', 'Mở Multiplayer để xem các chế độ chơi nhiều người đang có trong ứng dụng.'] ] },
  { id: 'data', title: 'Dữ liệu & cài đặt', icon: '◐', intro: 'Quản lý tùy chọn và dữ liệu học trên thiết bị.', questions: [
    ['Làm sao đổi giao diện sáng tối?', 'Mở Cài đặt và chọn Sáng hoặc Tối trong mục Chế độ hiển thị.'],
    ['Tôi xem quá trình học ở đâu?', 'Trang Tiến độ cho bạn thấy các chỉ số học, lịch sử và mức độ ghi nhớ.'] ] },
];

export default function HelpPage() {
  const { setPage } = useApp();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('start');
  const [expanded, setExpanded] = useState<number | null>(0);
  const topic = topics.find(item => item.id === active) || topics[0];
  const normalized = query.trim().toLocaleLowerCase('vi');
  const matches = useMemo(() => normalized ? topics.flatMap(item => item.questions.filter(([q, a]) => `${item.title} ${q} ${a}`.toLocaleLowerCase('vi').includes(normalized)).map(pair => ({ topic: item, pair }))) : [], [normalized]);
  const questions = normalized ? matches : topic.questions.map(pair => ({ topic, pair }));

  return <div className="lf-help">
    <section className="lf-help-hero"><div className="lf-help-hero-copy"><span className="lf-help-eyebrow"><Sparkles size={15} /> BẮT ĐẦU TỪ ĐÂY</span><h1>Mọi câu hỏi,<br /><em>một đường đi rõ ràng.</em></h1><p>Tìm nhanh cách thêm từ, ôn tập và dùng các công cụ của Lexforge.</p><label className="lf-help-search"><Search size={19} /><input value={query} onChange={e => { setQuery(e.target.value); setExpanded(0); }} placeholder="Bạn muốn tìm hướng dẫn gì?" aria-label="Tìm hướng dẫn" /><kbd>/</kbd></label></div><div className="lf-help-art" aria-hidden="true"><div className="lf-help-art-card back"><span>03 <small>ÔN TẬP</small></span><strong>Flashcard</strong><div className="lf-help-art-sketch"><BookOpen size={45} /><i>✦</i></div></div><div className="lf-help-art-card middle"><span>02 <small>THÊM TỪ</small></span><strong>Từ mới</strong><div className="lf-help-art-vocab"><b>word</b><b>nghĩa</b><i>↔</i></div></div><div className="lf-help-art-card front"><span>01 <small>BẮT ĐẦU</small></span><strong>Tạo nhóm</strong><div className="lf-help-art-folder"><Layers size={48} /><i>＋</i></div><small className="lf-help-art-pills">TOEIC &nbsp; DU LỊCH</small></div><i>✧</i></div></section>
    <section className="lf-help-quick"><div className="lf-help-heading"><span>3 BƯỚC ĐẦU TIÊN</span><h2>Bắt đầu học trong vài phút</h2></div><div className="lf-help-steps">{[
      ['01', 'Tạo nhóm từ', 'Gom từ theo chủ đề bạn muốn học.', 'groups', Layers],
      ['02', 'Thêm từ vựng', 'Nhập từng từ hoặc tải danh sách Excel.', 'vocabulary', BookOpen],
      ['03', 'Bắt đầu ôn', 'Lật thẻ, tự đánh giá và xem kết quả.', 'flashcard', Sparkles],
    ].map(([num, title, desc, page, Icon]) => <button key={String(num)} className="lf-help-step" onClick={() => setPage(page as any)}><span className="lf-help-step-num">{num as string}</span><Icon size={27} /><strong>{title as string}</strong><p>{desc as string}</p><b>Mở trang <ArrowUpRight size={16} /></b></button>)}</div></section>
    <section className="lf-help-library"><div className="lf-help-heading"><span>THƯ VIỆN HƯỚNG DẪN</span><h2>Chọn điều bạn muốn làm</h2></div><div className="lf-help-layout"><nav aria-label="Chủ đề hướng dẫn">{topics.map(item => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => { setActive(item.id); setQuery(''); setExpanded(0); }}><span>{item.icon}</span>{item.title}</button>)}</nav><div className="lf-help-topic"><div className="lf-help-topic-title"><span>{normalized ? '⌕' : topic.icon}</span><div><small>{normalized ? 'KẾT QUẢ TÌM KIẾM' : 'HƯỚNG DẪN'}</small><h3>{normalized ? `${matches.length} kết quả cho “${query}”` : topic.title}</h3></div></div>{!normalized && <p className="lf-help-intro">{topic.intro}</p>}{questions.length ? questions.map(({ topic: source, pair: [question, answer] }, index) => <div className="lf-help-question" key={`${source.id}-${question}`}><button aria-expanded={expanded === index} onClick={() => setExpanded(expanded === index ? null : index)}><span>{question}</span><ChevronDown size={18} /></button>{expanded === index && <p>{answer}</p>}</div>) : <p className="lf-help-empty">Chưa tìm thấy hướng dẫn. Thử “Excel”, “Flashcard” hoặc “Groq”.</p>}</div></div></section>
    <div className="lf-help-footer"><CalendarDays size={28} /><div><strong>Bạn đã có từ trong thư viện?</strong><p>Mở Lịch ôn để biết từ nào cần học tiếp hôm nay.</p></div><button onClick={() => setPage('schedule')}>Xem lịch ôn <ArrowUpRight size={17} /></button></div>
  </div>;
}
