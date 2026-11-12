# Buddy – AI Personal Buddy

Ứng dụng web full-stack đồng hành cùng trẻ em Việt Nam (ưu tiên 6–12 tuổi) trong việc trò chuyện khám phá, thực hiện nhiệm vụ tự lập từng bước, rèn luyện thói quen hằng ngày, tích lũy ngôi sao nỗ lực và nghe kể chuyện mỗi tối, kết hợp cùng cổng quản trị an toàn dành cho phụ huynh.

---

## 1. Kiến trúc & Các phân hệ chính

1. **Kids Home (`KidsHomeView`)**: Lời chào thân thiện dành cho bé **Minh Anh**, linh vật 3D **Buddy** đồng nhất, nút tương tác giọng nói, 4 thẻ hoạt động chính (*Việc hôm nay, Ngôi sao của con, Kể chuyện mỗi tối, Quà của con*) và danh sách nhiệm vụ từng bước nổi bật.
2. **Buddy Chat (`BuddyChatView` + `POST /api/chat`)**: Giao diện trò chuyện có gợi ý thân thiện, nút nhập giọng nói theo yêu cầu (chỉ xin quyền khi người dùng bấm nút Micro), bộ lọc an toàn cho trẻ em phía server và tích hợp Gemini (`gemini-3.8-flash`) kèm chế độ **Demo Fallback** có gắn nhãn rõ ràng khi chưa cấu hình `GEMINI_API_KEY`.
3. **Buddy Guide (`BuddyTaskStepRunner`)**: Thư viện 5 nhiệm vụ được duyệt (*Chuẩn bị cặp sách, Dọn góc học tập, Dọn đồ chơi, Rửa tay, Chuẩn bị đồ dùng ngày mai*). Hiển thị **mỗi bước trên 1 màn hình** kèm minh họa trực quan, nút *"Con làm xong rồi"*, *"Con chưa hiểu"* và đọc hướng dẫn.
4. **Buddy Routine (`BuddyActivitiesView`)**: Lịch trình trong ngày chia theo *Buổi sáng, Sau giờ học, Buổi tối*, liên kết trực tiếp với *Buddy Guide* và nhắc nhẹ trong ứng dụng.
5. **Buddy Stars (`BuddyStarsView` + `pointsPolicy.ts`)**: Sổ ngôi sao tích cực, không bao giờ trừ sao hay xếp hạng so sánh, có khóa `idempotencyKey` chống cộng trùng lặp cho cùng một hoạt động hợp lệ trong ngày.
6. **Buddy Rewards (`RewardWheelView` + `POST /api/rewards/spin`)**: Vòng quay kỷ niệm gắn kết gia đình cuối tháng (4–8 phần thưởng do phụ huynh duyệt, duy nhất 1 lượt quay mỗi chu kỳ tháng, không có ô mất lượt, yêu cầu phụ huynh xác nhận).
7. **Buddy Story (`BuddyStoryLibraryView` & `StoryPlayerView`)**: 5 câu chuyện thiếu nhi Việt Nam hoàn chỉnh thuộc 5 chủ đề, giao diện dịu mắt ban đêm, điều khiển Phát / Tạm dừng / Dừng / Đọc lại và câu hỏi suy ngẫm cuối truyện.
8. **My Buddy & Buddy Parents (`MyBuddySettingsView` & `ParentDashboardView`)**: Chọn giọng đọc Nam/Nữ cho một nhân vật Buddy duy nhất; cổng phụ huynh (Demo Gate với mã PIN mẫu `1234`) để sửa/duyệt nhiệm vụ, dùng AI soạn nháp bước hướng dẫn, đặt giờ lịch trình và xác nhận quà vòng quay.

---

## 2. Cài đặt & Biến môi trường

### Chạy ứng dụng
```bash
npm install
npm run dev
```
Ứng dụng chạy full-stack (Express + Vite middleware) tại `http://localhost:3000`.

### Biến môi trường (`.env`)
- `GEMINI_API_KEY`: Khóa API Gemini cấu hình trong mục **Settings > Secrets** của Google AI Studio (chỉ dùng ở phía server `server.ts`, tuyệt đối không lộ ra trình duyệt).
  - Khi có `GEMINI_API_KEY`: Kích hoạt phản hồi AI thực tế (`gemini-3.8-flash`), giọng đọc AI (`gemini-3.8-flash-lite-tts` với giọng Nam `Puck` và giọng Nữ `Kore`), và AI soạn nháp nhiệm vụ cho phụ huynh.
  - Khi chưa có `GEMINI_API_KEY`: Tự động chuyển sang chế độ **Demo Fallback** có gắn nhãn minh bạch, kết hợp giọng đọc trình duyệt (`Web Speech API`) hoặc chế độ đọc chữ trực quan.

### Tích hợp Firebase (Tùy chọn nâng cấp từ `IDataRepository`)
- Mặc định bản chạy thử sử dụng `LocalDemoRepository` (`src/services/repository.ts`) lưu trữ trong `localStorage` để kiểm thử tức thì mà không cần cấu hình ngoài.
- Toàn bộ thao tác đọc/ghi dữ liệu đã được trừu tượng hóa qua giao diện `IDataRepository` để sẵn sàng chuyển sang **Firebase Authentication & Cloud Firestore**.

---

## 3. Hướng dẫn kiểm thử 7 luồng tương tác (Acceptance Paths)

1. **Luồng 1 (Chuẩn bị cặp sách → Cộng sao 1 lần)**: Từ *Home*, chọn nhiệm vụ *"Chuẩn bị cặp sách"* → Bấm *"Con làm xong rồi"* qua từng bước 1 đến 4 → Hoàn thành và nhận `+2 sao` → Quay về *Home* kiểm tra tổng sao đã tăng; nếu làm lại nhiệm vụ này lần thứ 2 trong cùng ngày sẽ được khen ngợi nhưng không cộng trùng sao.
2. **Luồng 2 (Phụ huynh sửa/duyệt nhiệm vụ)**: Bấm *"Phụ huynh"* (hoặc *"Khu vực Phụ huynh"*) → Nhập mã PIN mẫu `1234` → Sửa tiêu đề/bước của một nhiệm vụ hoặc dùng AI soạn nháp nhiệm vụ mới → Bấm *"Phê duyệt & Áp dụng cho con"* → Quay lại màn hình của bé để thấy nội dung mới.
3. **Luồng 3 (Đọc & Nghe kể chuyện mỗi tối)**: Từ *Home*, chọn *"Kể chuyện mỗi tối"* → Mở một câu chuyện → Bấm *"Nghe đọc toàn bộ truyện"*, thử *Tạm dừng / Tiếp tục / Dừng* và chọn câu trả lời suy ngẫm cuối truyện để nhận `+1 sao`.
4. **Luồng 4 (Đổi giọng Nam / Nữ của Buddy)**: Mở tab *"Của con"* → Chọn *Giọng Nam ấm áp* hoặc *Giọng Nữ dịu dàng* → Tùy chọn được lưu lại và áp dụng cho mọi phần đọc thoại.
5. **Luồng 5 (Vòng quay phần thưởng gia đình cuối tháng)**: Khi bé đủ 15 sao trong tháng (có thể hoàn thành thêm 1 nhiệm vụ từ mức 14 sao khởi tạo để đạt 16 sao), mở *"Quà của con"* → Bấm *"Quay thưởng kỷ niệm tháng này (1 lượt)"* → Mở *Buddy Parents* → Tab *3. Vòng quay & Xác nhận Quà* → Bấm *"Xác nhận phần thưởng này"*.
6. **Luồng 6 (Buddy Chat an toàn & minh bạch)**: Mở tab *"Buddy"* → Nhấn các chip gợi ý hoặc nhập câu hỏi → Kiểm tra phản hồi tiếng Việt thân thiện (kèm nhãn *AI Trực tuyến* hoặc *Chế độ Demo*).
7. **Luồng 7 (Lưu trữ bền vững sau khi Refresh)**: Tải lại trang (F5) → Mọi ngôi sao, nhiệm vụ đã sửa, lượt quay thưởng và giọng đọc đã chọn đều được giữ nguyên.
