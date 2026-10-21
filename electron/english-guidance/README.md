# Lexforge English Guidance v1.1

## Mục đích và giới hạn

Bộ hướng dẫn biên soạn cho trợ lý dùng chung ở dashboard và bong bóng nổi của Lexforge: tạo tiếng Anh chính xác, tự nhiên, phù hợp nhiệm vụ; sửa câu với giải thích đúng; giữ ý khi diễn đạt lại; kiểm tra phản hồi trước khi hiển thị.

Đây là tài liệu vận hành của ứng dụng, không được IELTS chứng nhận. Không phải hệ thống chấm thi chính thức, danh sách từ bắt buộc hay giáo trình ôn thi toàn diện. Không bảo đảm band, tính đúng tuyệt đối hoặc phát hiện mọi lỗi. Không sửa ứng dụng, triển khai dịch vụ, chọn model, xây RAG hay cơ sở dữ liệu vector trong phạm vi bàn giao này.

IELTS Speaking xét Fluency and coherence, Lexical resource, Grammatical range and accuracy, Pronunciation. Writing xét Task Achievement ở Task 1 hoặc Task Response ở Task 2, cùng Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy. Nguồn: source_speaking và source_writing.

Bộ này chỉ vận dụng những nguyên tắc thích hợp cho trợ lý. Pass ở quality gate không có nghĩa đạt một band. Không chấm phát âm, trọng âm, ngữ điệu, tốc độ, ngập ngừng hoặc độ trôi chảy thực tế từ transcript. Không quy đổi số từ khó, thành ngữ hay CEFR thành band.

## Sáu file

1. README.md: hợp đồng sử dụng, phạm vi và cách chọn hướng dẫn.
2. sources.json: nguồn đã dùng, trạng thái đối chiếu và vị trí tra cứu.
3. english_policy.json: 24 quy tắc; đây là nguồn quy tắc có thẩm quyền trong bộ tài liệu.
4. curated_examples.json: 24 ví dụ biên soạn, chia đều general, speaking, writing. Bốn cặp đối chiếu: 13/14, 15/16, 17/18, 19/20. Các cặp minh họa lựa chọn theo hoàn cảnh, không quy định cách nói chỉ được nói hoặc cách viết chỉ được viết.
5. quality_gate.md: hợp đồng kiểm tra, schema kết quả và xử lý lỗi vận hành.
6. evaluation_cases.json: 30 ca đặc tả hành vi mong đợi, dùng khi triển khai và đánh giá hồi quy; không phải kết quả thử nghiệm đã chạy trên model.

Các câu ví dụ và ca kiểm tra đều do biên tập, không phải bài mẫu IELTS chính thức. source_ids chỉ dẫn đến chủ điểm nguồn hỗ trợ, không có nghĩa nguồn xác nhận toàn bộ ví dụ hoặc thiết kế ứng dụng. Mảng rỗng nghĩa là quyết định biên tập không gắn với một nguồn trực tiếp trong phiên bản này; cần chuyên gia duyệt. optional_upgrade=null nghĩa là không có đề xuất nâng cấp hữu ích. Câu đúng có minimal_correction=null. Câu có lỗi cũng có thể có minimal_correction=null nếu chưa đủ ngữ cảnh để sửa mà giữ ý, như example_11. error_status mô tả ngữ pháp trong ngữ cảnh được ghi ở topic và lời giải thích, không mô tả quyền được sửa một trích dẫn; example_23 là bài sửa câu, còn case_15/16 kiểm tra tác vụ trích nguyên văn.

## Nguồn và cách hiểu nhãn

Chín nguồn đã được mở và đọc ngày 2026-10-21. Bản Writing ghi Updated May 2023; không quan sát được phiên bản Speaking nên để null. Cambridge trả lỗi truy cập ở các trang thử mở; không liệt kê các trang đó như nguồn đã dùng. Oxford là nguồn từ điển thay thế. Ngày truy cập không phải ngày cập nhật tài liệu. Lượt sửa v1.1 giữ nguyên sources.json và các mốc xác minh; không mở lại nguồn hoặc bổ sung nguồn mới.

origin=official_criterion chỉ dùng cho diễn giải ngắn tiêu chí ngôn ngữ chính thức ở rule_05, rule_11, rule_15. Cách biến chúng thành chỉ dẫn, phạm vi applies_to và severity đều do ứng dụng thiết kế. Mọi quy tắc vận hành còn lại có origin=editorial_policy, kể cả khi tham khảo IELTS hoặc nguồn ngữ pháp.

Severity là mức xử lý của ứng dụng, không phải mức trừ band:

- critical: sai ý, hỏng nội dung phải giữ nguyên, bịa dữ kiện, đánh giá âm thanh không có bằng chứng, vượt ranh giới dữ liệu/lệnh hoặc hành động. Chặn bản nháp đến khi có cách xử lý đủ căn cứ.
- major: sai ngôn ngữ/giải thích, sai thể loại hoặc tuyên bố chất lượng không đủ căn cứ; cần sửa hoặc nêu giới hạn.
- minor: vấn đề nhất quán hoặc độ dài có căn cứ theo nhiệm vụ; không biến sở thích cá nhân thành lỗi. Nếu thực sự vi phạm quy tắc, vẫn dùng revise.

Severity của issue lấy nguyên từ quy tắc; nếu một vấn đề vi phạm nhiều quy tắc, ưu tiên ghi quy tắc có mức cao nhất và bằng chứng phù hợp. Tùy chọn văn phong không phải issue. Severity không quyết định một mình khả năng tự sửa: lỗi major có thể là sửa cục bộ; lỗi critical có thể khắc phục bằng căn cứ trực tiếp, như khôi phục đúng số từ nguồn.

## Chất lượng phản hồi và mức hoàn thành tác vụ

status chỉ đánh giá chất lượng bản nháp: pass khi phản hồi phù hợp và chính xác trong phạm vi kiểm tra; revise khi có lỗi xác định; uncertain khi reviewer chưa thể kết luận chất lượng hoặc kiểm tra chưa hoàn tất. Thiếu đầu vào của nhiệm vụ không tự làm một lời giải thích giới hạn chính xác thành uncertain.

task_completion độc lập với status: complete khi đã đáp ứng toàn bộ yêu cầu ban đầu; partial khi chưa đáp ứng trọn vẹn dù không bị chặn bởi đầu vào thiếu, kể cả bỏ lỡ nội dung yêu cầu vì enum không có not_completed; blocked_by_missing_input khi đầu vào thiết yếu thiếu ngăn thực hiện phần cốt lõi; not_applicable khi mẫu đầu ra cô lập không có nhiệm vụ người dùng gốc để đối chiếu. Đây không phải điểm ngữ pháp hoặc cờ chất lượng. Một câu trả lời đúng về việc chưa có nguồn có thể pass + blocked_by_missing_input; thông báo đúng về note chưa lưu có thể pass + partial. Không cấp complete chỉ vì bản nháp tự nhận đã làm xong.

case_08/09/26 dùng pass + blocked_by_missing_input. case_25 kiểm tra reviewer thiếu nguồn để xác minh chính phản hồi; case_27 kiểm tra lượt reviewer bị lỗi dịch vụ. Mọi ca có expected_task_completion. Hai trường mô tả bản nháp đầu vào, không tự chứng nhận bản thay thế.

Ứng dụng có thể tự hiển thị sửa chính tả, hòa hợp, cấu trúc cục bộ hoặc collocation có căn cứ khi kiểm tra bảo toàn đạt và không còn vấn đề quan trọng chưa giải quyết. Không cần người dùng duyệt từng lỗi nhỏ. Sửa rủi ro cao cần căn cứ trực tiếp đủ xác nhận; nếu thiếu, giữ dữ liệu người dùng và nêu ngắn gọn điều cần làm rõ. Đây là chấp nhận dựa trên model cộng kiểm tra ràng buộc, chưa phải xác minh độc lập.

Quyết định accepted_original, accepted_revision, needs_clarification hoặc review_unavailable thuộc ứng dụng theo quality_gate.md, không do reviewer tự cấp. Giữ tối đa hai lượt model và không có lượt đánh giá ngôn ngữ sau sửa; status=revise của bản nháp được giữ nguyên dù ứng dụng chấp nhận bản sửa.

## Chọn chế độ và ngôn ngữ

applies_to có ngữ nghĩa hợp: luôn nạp các rule chứa general; cộng các rule có nhãn nhiệm vụ. correction và summary là loại thao tác; có thể cộng speaking hoặc writing theo thể loại đích. Lời khuyên và trò chuyện thường dùng general. Các ràng buộc ngôn ngữ vẫn được áp dụng qua các rule general khi không có nhãn thi.

Chọn theo sản phẩm người dùng cần: gõ câu luyện nói vẫn là speaking; đọc yêu cầu soạn email qua microphone vẫn là writing. Nếu không rõ, dùng general và sửa tối thiểu; chỉ hỏi khi thiếu thông tin có thể làm đổi nghĩa, người nhận hoặc thể loại. Với lựa chọn ít rủi ro, nêu giả định ngắn rồi tiếp tục. Không hỏi lại chỉ để quyết định giữa hai cách diễn đạt đều hợp lệ.

Theo ngôn ngữ người dùng yêu cầu; nếu không có, xét yêu cầu mới nhất và ngữ cảnh. Chỉ biên tập ngôn ngữ của phần tiếng Anh do trợ lý tạo, kể cả trong câu trả lời trộn Việt–Anh. Vẫn kiểm tra tính đúng của lời giải thích ngữ pháp và các tuyên bố về nguồn, ý nghĩa, hành động bằng mọi ngôn ngữ; đây không phải chấm văn phong tiếng Việt.

Academic Writing và General Training không đồng nhất về register; thư General Training có thể thân mật hoặc trang trọng theo người nhận. Không áp một register lên mọi loại writing. Chỉ nhận xét Task Achievement/Task Response khi có đề và tài liệu nguồn cần thiết. Nếu chỉ sửa ngữ pháp thì thiếu đề không tự làm nhiệm vụ bất khả thi.

## Tích hợp tối giản bằng file

Đọc bốn JSON UTF-8 bằng bộ parse nghiêm ngặt khi khởi động hoặc phát hành; kiểm tra trường, enum, ID, tham chiếu và version. Dừng nạp bộ cấu hình sai. Giữ cùng phiên bản cho dashboard và bong bóng nổi.

Nạp các quy tắc liên quan vào phần chỉ dẫn được ứng dụng kiểm soát. Dùng examples để minh họa đúng tình huống, không nạp toàn bộ 24 ví dụ cho mọi lượt. Dùng sources làm tài liệu tra cứu; không cần gọi web mỗi phản hồi. Dữ liệu người dùng nằm trong vùng dữ liệu riêng, không được nối thành chỉ dẫn có quyền cao hơn.

Tách phản hồi văn bản khỏi action tạo/cập nhật note. Sau lượt tạo phản hồi, áp dụng quality_gate.md. Gate không được quyền gọi công cụ hoặc sửa action. Quyền hành động thuộc workflow riêng, dựa trên yêu cầu rõ ràng của người dùng. Không lưu ghi chú chỉ vì người dùng yêu cầu sửa hoặc tóm tắt.

Chạy evaluation_cases trên bộ kiểm tra đã triển khai, ghi model/phiên bản cấu hình/kết quả và đưa cho người đánh giá độc lập trước khi tuyên bố chất lượng. Kiểm tra cấu trúc file không thay thế đánh giá sư phạm hoặc thử nghiệm sản phẩm.
