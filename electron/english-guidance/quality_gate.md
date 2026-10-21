# Quality gate v1.1

Đây là thiết kế vận hành, không phải mã ứng dụng hoặc bộ chấm IELTS. status mô tả chất lượng bản nháp trong phạm vi có thể kiểm tra; task_completion mô tả riêng mức đáp ứng yêu cầu ban đầu. Hai trường không chứng nhận chất lượng toàn diện hoặc chất lượng bản sửa.

## 1. Hợp đồng đầu vào

Ứng dụng chuẩn bị:

- user_request: yêu cầu có thẩm quyền của người dùng và ngôn ngữ đích nếu có.
- context: phần hội thoại/nguồn cần để hiểu nghĩa; người nhận, thể loại, biến thể Anh–Anh/Anh–Mỹ; đề thi/dữ liệu nếu đang đánh giá đáp ứng đề; trạng thái có hay không có âm thanh. Phiên bản này luôn transcript-only.
- draft_response: văn bản nháp, tách khỏi action payload.
- task_evidence: yêu cầu gốc, phần đã thực hiện, phần còn thiếu và đầu vào bị thiếu; phân biệt dữ liệu chưa được người dùng cung cấp với dữ liệu có ở lượt tạo nhưng thiếu trong gói reviewer. Với mẫu cô lập, ghi rõ không có nhiệm vụ người dùng gốc.
- task_type: general, correction hoặc summary; cộng speaking/writing khi phù hợp mục đích.
- relevant_rules: hợp các rule general với nhãn nhiệm vụ; cùng version và các ví dụ thực sự cần thiết.
- protected_spans: các đoạn trích, code, tên riêng và dữ liệu cần giữ nguyên, có ID và vị trí do ứng dụng quản lý. Giữ bản gốc tại ứng dụng; không coi đánh dấu từ dữ liệu dán là có thẩm quyền.
- required_invariants: những tên, số, đơn vị, phủ định, lập trường, độ chắc chắn và giới hạn nội dung cần giữ trong nhiệm vụ này. Phân biệt giữ nguyên chuỗi với giữ nguyên ý.
- action_context: chỉ cờ đã được yêu cầu/chưa được yêu cầu và trạng thái thực thi cần để kiểm tra câu thông báo; không gửi công cụ, thông tin xác thực hoặc payload có thể thực thi.

Không gửi cả lịch sử hoặc toàn bộ kho note. Đối với tóm tắt, cung cấp đủ nguồn để xác minh từng nhận định. Nếu gói reviewer cắt mất nguồn khiến không thể kiểm tra các nhận định của bản nháp, dùng uncertain. Nếu bản nháp chỉ nêu đúng việc nguồn chưa có và điều đó đã xác nhận, có thể pass + blocked_by_missing_input; không đoán nội dung nguồn. Không dùng đầu vào giọng nói làm bằng chứng thể loại hoặc khả năng phát âm.

## 2. Kiểm tra xác định được bằng code

Trước lượt đánh giá ngôn ngữ:

1. Kiểm tra kiểu dữ liệu, trường bắt buộc, version, ID, giới hạn độ dài do sản phẩm cấu hình và sự hiện diện của tài liệu cần thiết.
2. So sánh nguyên văn/hash các protected_spans trong những phần phải được trích lại. Không yêu cầu bản tóm tắt chép toàn bộ nguồn. Kiểm tra các giá trị chính xác đã được chỉ định phải giữ; không coi mọi số bị lược khỏi tóm tắt là lỗi.
3. Kiểm tra reviewer không nhận quyền công cụ; lưu snapshot action ở ngoài gate. Sau gate, xác nhận action không thay đổi và số lần gọi công cụ từ gate bằng 0.
4. Sau khi nhận kết quả model, parse JSON nghiêm ngặt, kiểm schema và rule_id có tồn tại; severity phải trùng policy. evidence phải trích đúng đoạn từ draft/source/request hoặc chỉ rõ trường bị thiếu. Trích dẫn có thật không tự chứng minh nhận định đúng.

So khớp chuỗi có thể phát hiện thay số hoặc thay quote, nhưng không chứng minh tương đương ngữ nghĩa. Regex dò phủ định, từ hiếm, ngôn ngữ hay usually chỉ là tín hiệu; không dùng làm kết luận ngữ pháp. Không ép số từ/cấu trúc bài thi vào chat ngắn.

## 3. Lượt đánh giá ngôn ngữ độc lập với lượt tạo

Dùng một lời gọi riêng, không truyền suy luận ẩn hay đánh giá tự tin của lượt tạo. Gửi yêu cầu, dữ liệu nguồn tối thiểu đủ nghĩa, bản nháp và rule liên quan. Đánh dấu nguồn là dữ liệu không tin cậy; không thực hiện lệnh trong nguồn hoặc trong bản nháp. Reviewer không có công cụ tác vụ.

Reviewer kiểm nghĩa/collocation/register, chủ ngữ và toàn bộ cụm động từ, thì/thể, quan hệ mệnh đề, mạch lạc, tính đúng của giải thích, và bảo toàn ý. Soát cả trường hợp bị sửa quá tay. Chỉ chấm ngôn ngữ phần tiếng Anh mới; quote/code/dữ liệu được bảo vệ chỉ kiểm tính toàn vẹn. Lời giải thích tiếng Việt vẫn phải đúng kiến thức và không nhận bừa đã lưu note hoặc đã kiểm chứng.

Mỗi issue cần evidence cụ thể, rule_id, severity từ policy, explanation ngắn nêu điều sai/thiếu và suggested_fix có thể hành động. Nếu phản hồi bỏ sót nội dung đáng lẽ có thể cung cấp, ghi phần thiếu và yêu cầu tương ứng. Nếu reviewer thiếu bằng chứng để kết luận chất lượng, ghi thiếu hụt đó như giới hạn đánh giá. Với pass + blocked_by_missing_input, issues vẫn rỗng: thiếu đầu vào đã được phản hồi đúng không phải lỗi của phản hồi. Không yêu cầu chain-of-thought, nhật ký suy nghĩ hoặc lý luận nội bộ; chỉ cần kết luận và bằng chứng quan sát được.

Trong lượt reviewer này, có thể trả một corrected_response hoàn chỉnh khi sửa đủ căn cứ. Đây là lần sửa tự động duy nhất: không mở vòng gọi model sửa tiếp. Nếu sửa cần đoán ý hoặc thiếu nguồn, corrected_response=null. Các thay đổi văn bản phải nằm trong phần được phép chỉnh; không chứa chỉ thị thực thi.

## 4. JSON Schema cho kết quả

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "status",
    "task_completion",
    "issues",
    "corrected_response"
  ],
  "properties": {
    "status": {
      "enum": [
        "pass",
        "revise",
        "uncertain"
      ]
    },
    "issues": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "rule_id",
          "severity",
          "evidence",
          "explanation",
          "suggested_fix"
        ],
        "properties": {
          "rule_id": {
            "type": "string",
            "pattern": "^rule_[0-9]{2}$"
          },
          "severity": {
            "enum": [
              "critical",
              "major",
              "minor"
            ]
          },
          "evidence": {
            "type": "string",
            "minLength": 1
          },
          "explanation": {
            "type": "string",
            "minLength": 1
          },
          "suggested_fix": {
            "type": "string",
            "minLength": 1
          }
        }
      }
    },
    "corrected_response": {
      "type": [
        "string",
        "null"
      ],
      "minLength": 1
    },
    "task_completion": {
      "enum": [
        "complete",
        "partial",
        "blocked_by_missing_input",
        "not_applicable"
      ]
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "status": {
            "const": "pass"
          }
        }
      },
      "then": {
        "properties": {
          "issues": {
            "maxItems": 0
          },
          "corrected_response": {
            "type": "null"
          }
        }
      }
    },
    {
      "if": {
        "properties": {
          "status": {
            "enum": [
              "revise",
              "uncertain"
            ]
          }
        }
      },
      "then": {
        "properties": {
          "issues": {
            "minItems": 1
          }
        }
      }
    },
    {
      "if": {
        "properties": {
          "status": {
            "const": "uncertain"
          }
        }
      },
      "then": {
        "properties": {
          "corrected_response": {
            "type": "null"
          }
        }
      }
    }
  ]
}
```

Schema không tự kiểm tra ID có thật hoặc mức severity tương ứng; ứng dụng tra english_policy.json. status và task_completion luôn nói về bản nháp đầu vào; không suy một trường từ trường còn lại. corrected_response là đề xuất thay thế, không phải bằng chứng bản thay thế đã được đánh giá lần hai.

Ví dụ kết quả cho lỗi giải thích trong case_04:

```json
{
  "status": "revise",
  "issues": [
    {
      "rule_id": "rule_12",
      "severity": "major",
      "evidence": "draft_response: Sau usually luôn dùng động từ nguyên mẫu.",
      "explanation": "Dạng take phù hợp với chủ ngữ I ở hiện tại đơn trong ngữ cảnh thói quen; không thể suy ra từ usually một quy tắc cho mọi cấu trúc.",
      "suggested_fix": "Giữ câu đã sửa và thay lời giải thích bằng quy tắc chủ ngữ–động từ trong ngữ cảnh cụ thể."
    }
  ],
  "corrected_response": "I usually take the bus to work. Với chủ ngữ I và ý thói quen hiện tại ở đây, dùng take ở hiện tại đơn.",
  "task_completion": "partial"
}
```

Ví dụ cho case_26: lời giới hạn đúng, dù chưa thể tóm tắt báo cáo:

```json
{
  "status": "pass",
  "task_completion": "blocked_by_missing_input",
  "issues": [],
  "corrected_response": null
}
```

Ví dụ cho case_25: reviewer thiếu nguồn để xác minh tính trung thành của mẫu cô lập:

```json
{
  "status": "uncertain",
  "task_completion": "not_applicable",
  "issues": [
    {
      "rule_id": "rule_24",
      "severity": "major",
      "evidence": "draft_response: Ana told Mai that Ana was tired.; context: gói gửi reviewer bị thiếu cả hai.",
      "explanation": "Câu có thể đúng ngữ pháp nhưng chưa xác minh được Ana có đúng là người mệt trong nguồn hay không.",
      "suggested_fix": "Khôi phục câu nguồn và ngữ cảnh cần thiết vào gói đánh giá; chưa tự thay tên người."
    }
  ],
  "corrected_response": null
}
```

## 5. Quyết định và giới hạn sửa

### 5.1. Chất lượng bản nháp: status

- pass: phản hồi phù hợp và chính xác trong phạm vi kiểm tra; không có lỗi hoặc nghi vấn quan trọng chưa giải quyết. Lời giới hạn đúng về đầu vào thiếu cũng có thể pass. issues rỗng, corrected_response=null.
- revise: có ít nhất một lỗi xác định, bất kể severity. Nếu còn nghi vấn khác, ghi cùng issues; chỉ đề xuất bản sửa khi đủ căn cứ giải quyết toàn bộ vấn đề quan trọng. Nếu chưa đủ, corrected_response=null. Không đổi lỗi đã xác định thành uncertain chỉ vì còn thiếu thông tin khác.
- uncertain: chưa xác định được lỗi nhưng reviewer thiếu bằng chứng hoặc có bất đồng quan trọng về chính chất lượng phản hồi, hoặc lượt kiểm tra bắt buộc chưa hoàn tất. issues ghi điều chưa thể kết luận; corrected_response=null. Không dùng nhãn này chỉ vì nhiệm vụ người dùng thiếu đầu vào.

Tùy chọn văn phong không tạo issue. Không suy ra pass từ câu văn trôi chảy hoặc lời tự nhận đúng IELTS. Không đánh pass cho phản hồi bịa dữ kiện nhằm che thiếu nguồn: khi xác định được việc thêm thông tin ngoài nguồn, dùng revise theo rule_21. Nếu nguồn có ở lượt tạo nhưng reviewer không được xem nên chưa kiểm chứng được nội dung, dùng uncertain, không tự kết luận bịa đặt.

### 5.2. Mức đáp ứng yêu cầu ban đầu: task_completion

- complete: các đầu ra/bước được yêu cầu đã được đáp ứng theo bằng chứng tác vụ quan sát được. Nhãn này không tự bảo đảm chất lượng; một bản sửa câu đã cung cấp đầy đủ vẫn có thể revise vì thêm chỉ thị note trái phép, như case_20.
- partial: chưa đáp ứng trọn vẹn yêu cầu dù không bị chặn bởi đầu vào thiếu; có thể còn nội dung hoặc bước chưa hoàn tất. Ví dụ, câu sửa đúng nhưng giải thích sai; hoặc nội dung note đã soạn nhưng chưa lưu. Vì enum không có not_completed, partial cũng bao gồm bản nháp bỏ lỡ toàn bộ nội dung được yêu cầu dù đã đủ đầu vào, như case_18; không ngầm tuyên bố đã hoàn tất một phần nào. Khi chưa đủ bằng chứng xác nhận hoàn thành toàn bộ, chỉ ghi phần đã biết và dùng partial, không tự nhận complete.
- blocked_by_missing_input: thiếu đầu vào thiết yếu ngăn hoàn thành phần cốt lõi của yêu cầu ban đầu. Nếu vừa có phần làm được vừa có phần cốt lõi bị chặn, ưu tiên nhãn này; nêu phần đã làm trong phản hồi khi hữu ích.
- not_applicable: không có nhiệm vụ người dùng gốc để đối chiếu mức hoàn thành, như mẫu đầu ra cô lập. Không dùng cho API lỗi, yêu cầu khó hoặc nhiệm vụ thiếu dữ liệu.

Phân loại completion từ yêu cầu và bằng chứng thực tế, không từ lời tự nhận của bản nháp hoặc status. Đây không phải nhãn bất định thứ hai. case_08/09/26 là pass + blocked_by_missing_input; case_21 là pass + partial. case_25 dùng uncertain vì chưa đánh giá được độ trung thành của mẫu; case_27 dùng uncertain vì quy trình kiểm tra chưa hoàn tất, dù fixture đã xác nhận một gợi ý đáp ứng yêu cầu. Thiếu đề không cản việc chỉ sửa ngữ pháp, như case_10.

### 5.3. Rủi ro của thay đổi và điều kiện tự chấp nhận

Phân loại theo từng thay đổi trong diff giữa bản nháp và bản sửa, cùng nguồn đối chiếu. Severity mô tả mức nghiêm trọng của lỗi; không phải quyền tự sửa. major có thể là lỗi cục bộ dễ sửa; critical có thể sửa được khi có căn cứ trực tiếp. Nếu bản sửa chứa cả thay đổi thông thường và rủi ro cao, áp dụng điều kiện chặt hơn cho phần rủi ro cao; mọi vấn đề quan trọng đều phải được giải quyết.

Sửa ngôn ngữ thông thường gồm chính tả, hòa hợp chủ ngữ–động từ, cấu trúc cục bộ có ngữ cảnh rõ, dùng từ/collocation có căn cứ và không đổi nghĩa. Ứng dụng được tự hiển thị bản sửa sau reviewer khi:

1. Kết quả hợp schema; các issue có bằng chứng cụ thể và giải thích gắn với rule, không chỉ tự báo an toàn hoặc tự tin cao.
2. Thay đổi tương ứng với các issue được xác định, đủ ngữ cảnh, không phát sinh nội dung hoặc hành động ngoài yêu cầu.
3. Các kiểm tra bảo toàn xác định được bằng code đều đạt; reviewer đã đối chiếu nghĩa và không còn vấn đề quan trọng chưa giải quyết trong hồ sơ đánh giá.
4. Không có dấu hiệu đổi ý, lập trường, phủ định, độ chắc chắn, tên, số, đơn vị, dữ liệu, quote/code hoặc thêm dữ kiện. Nếu có, chuyển sang điều kiện rủi ro cao dưới đây.

Không bắt buộc mẫu sửa đã được chuyên gia duyệt hoặc người dùng phê duyệt từng lỗi nhỏ. Đây là chấp nhận dựa trên đánh giá model và kiểm tra ràng buộc; việc code không phát hiện thay đổi không chứng minh tương đương nghĩa hoặc xác minh độc lập mọi sửa đổi.

Thay đổi rủi ro cao gồm các thay đổi ý/dữ liệu kể trên; thêm dữ kiện; tuyên bố về âm thanh không có bằng chứng; tạo/sửa note ngoài workflow; và mọi thay đổi reviewer chưa đủ căn cứ thực hiện. Chỉ tự sử dụng bản sửa khi có căn cứ trực tiếp đủ xác nhận việc khắc phục và không còn vấn đề quan trọng chưa giải quyết. Ví dụ: khôi phục 15 thay cho 50 đúng theo câu nguồn của case_11; khôi phục quote đúng từng ký tự ở case_16; bỏ tuyên bố phát âm khi metadata xác nhận transcript-only; hoặc bỏ chỉ thị note khỏi văn bản mà giữ nguyên action payload. Mỗi sửa phải chỉ ra đoạn nguồn hoặc metadata có thẩm quyền, phép thay đổi và ràng buộc kiểm lại. Tự báo an toàn, tự tin cao hay đúng IELTS không thay được bằng chứng.

Nếu không đủ căn cứ, không dùng bản sửa đoán ý; giữ nguyên dữ liệu người dùng và đưa thông báo/đề xuất ngắn nêu đúng điều cần làm rõ. Ví dụ: “Bạn muốn nối ý nào sau ‘Although the route is longer’?” Không đưa bản nháp nghi có lỗi nghiêm trọng ra dùng như đã kiểm chứng; cũng không liên tục yêu cầu người dùng tìm chuyên gia cho chat thông thường.

### 5.4. Quyết định của ứng dụng và số lượt

Tối đa hai lượt gọi trên đường đi đầy đủ: một lượt tạo và một lượt reviewer có thể đề xuất một bản sửa. V1.1 KHÔNG có lượt đánh giá ngôn ngữ thứ hai sau sửa. Chỉ kiểm lại schema, protected_spans, required_invariants xác định được bằng code và tính bất biến của action. Nếu không đạt thì dừng; không gọi model sửa thêm.

Ứng dụng quyết định trạng thái vận hành ngoài JSON reviewer:

- accepted_original: status=pass và các kiểm tra xác định đều đạt. Có thể hiển thị lời giới hạn đúng cùng task_completion=blocked_by_missing_input; không yêu cầu complete để được hiển thị.
- accepted_revision: status=revise, có corrected_response và mọi điều kiện tương ứng ở 5.3 cùng kiểm tra sau sửa đều đạt. Giữ status=revise và task_completion của bản nháp trong hồ sơ; bản thay thế chưa được đánh giá ngôn ngữ lần hai.
- needs_clarification: cần người dùng làm rõ ý/nguồn mà chưa có bản trả lời hoặc bản sửa đủ căn cứ để chấp nhận. Hiện thông báo ngắn, không thao tác dữ liệu. Nếu bản nháp đã là câu hỏi làm rõ chính xác thì dùng accepted_original, không hạ chất lượng của câu hỏi đó.
- review_unavailable: lỗi dịch vụ, thiếu dữ liệu chỉ trong gói reviewer hoặc bất đồng đánh giá nội bộ. Chưa tự chấp nhận bản đang nghi vấn; thông báo ngắn và cho phép thử lại ở lượt mới, không mặc định bắt người dùng giải quyết lỗi nội bộ.

Các trạng thái trên không nằm trong schema reviewer; ứng dụng tính từ các điều kiện và bằng chứng, không tin nhãn tự cấp của model. Ghi bản nào được hiển thị, kiểm tra nào đã chạy, có sửa hay không và không có đánh giá ngôn ngữ sau sửa. Không đổi revise thành pass hoặc gắn nhãn đã kiểm chứng độc lập cho accepted_revision. Không thay đổi action payload hoặc thực hiện note ở bất kỳ nhánh nào.

## 6. Lỗi dịch vụ và thiếu dữ liệu

API timeout, 429, hết ngân sách lượt gọi hoặc JSON không hợp lệ: không retry tự động trong cùng gate. Nếu chưa có lỗi xác định, ứng dụng tạo uncertain với rule_24/major, evidence là lỗi thực tế, corrected_response=null; nếu đã phát hiện lỗi xác định bằng code thì giữ revise và ghi cả lỗi kiểm tra. task_completion được xác định riêng từ bằng chứng tác vụ: lỗi API không tự có nghĩa blocked_by_missing_input hoặc not_applicable. Chỉ dùng complete khi đã có căn cứ; nếu mới biết một phần đã đáp ứng thì partial.

Nếu toàn bộ phạm vi thật sự xác định được bằng code, như kiểm tra trích nguyên văn, có thể hoàn tất bằng code mà không cần reviewer. Không tuyên bố đã kiểm ngôn ngữ. Nếu vẫn cần lượt đánh giá ngôn ngữ mà chưa chạy được, giữ uncertain/revise theo bằng chứng hiện có và review_unavailable; không đổi thành pass vì bản nháp có vẻ ổn. Ví dụ thông báo: “Chưa hoàn tất kiểm tra phản hồi. Bạn có thể thử lại.”

Thiếu đầu vào của nhiệm vụ và thiếu bằng chứng của reviewer là hai tình huống riêng. Khi metadata xác nhận tệp người dùng không đọc được và bản nháp chỉ báo đúng giới hạn đó, dùng pass + blocked_by_missing_input. Khi reviewer không có nguồn để xác minh một bản tóm tắt đã tạo, dùng uncertain. Khi biết bản tóm tắt thêm dữ kiện không có trong nguồn, dùng revise. Không dùng uncertain để đòi thông tin không liên quan.

Gate không thực hiện, hủy hoặc chỉnh action note. Workflow riêng quyết định tiếp tục/chờ theo quyền hiện có; chỉ thông báo thành công sau kết quả thực thi thật. Lỗi gate không tạo thêm quyền tác vụ.

## 7. Độ trễ, dữ liệu và đo chất lượng

Lọc rule theo nhiệm vụ, cache cấu hình theo version, chạy kiểm tra code trước, giới hạn phản hồi theo yêu cầu. Chỉ gửi nguồn liên quan; giữ placeholder và ánh xạ tại máy cho đoạn bảo vệ không cần đọc để hiểu ý. Không che phần ngữ cảnh thiết yếu rồi coi reviewer đủ dữ liệu. Log tối thiểu ID ca, version, trạng thái, độ trễ và loại lỗi; tránh lưu toàn bộ văn bản riêng tư nếu không cần.

Cùng một model ở hai lượt vẫn có thể lặp lại cùng lỗi. Lượt reviewer riêng giúp tách nhiệm vụ nhưng không tạo tính độc lập về năng lực. Không lấy tỉ lệ model tự báo pass làm độ chính xác.

Đánh giá triển khai bằng 30 ca trong evaluation_cases.json; không gửi expected_status hoặc expected_task_completion cho reviewer. Đánh giá hai trường riêng, đồng thời kiểm tra nhánh chấp nhận bản sửa theo 5.3–5.4 bằng fixture bản sửa và bằng chứng kiểm tra; không suy nhãn chất lượng từ completion. So kết quả với từng required_observations và forbidden_changes, không so cứng một cách diễn đạt. Ca deterministic kiểm chuỗi/ràng buộc; human_or_model cần người đánh giá hoặc model đánh giá riêng; mixed cần cả hai. Model đánh giá riêng vẫn là phép đo bằng model, chưa thay thế chuyên gia độc lập.

Đo riêng: bỏ sót lỗi, sửa sai câu vốn đúng, làm đổi nghĩa, giải thích sai, phát hiện lỗi critical, thực hiện note trái phép, độ trễ và tỉ lệ uncertain. Báo số mẫu và mẫu số. Chuyên gia cần duyệt nhãn kỳ vọng, các trường hợp tùy ngữ cảnh và thêm tập kiểm tra chưa dùng để soạn policy. Chưa chạy bộ ca trên hệ thống và chưa có đánh giá độc lập thì không tuyên bố bộ test đã chứng minh độ chính xác.
