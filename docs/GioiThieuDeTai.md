# Giới thiệu đề tài

## 1. Bối cảnh và động lực

Trong môi trường làm việc hiện đại, đặc biệt là các tổ chức có mạng nội bộ (LAN - Local Area Network), nhu cầu giao tiếp thoại và họp trực tuyến giữa các thành viên trong cùng một tòa nhà hoặc khuôn viên là rất phổ biến. Tuy nhiên, các giải pháp thương mại hiện tại như Zoom, Microsoft Teams hay Google Meet chủ yếu được thiết kế cho mô hình hoạt động qua Internet công cộng. Điều này dẫn đến một số hạn chế đáng kể: độ trễ không cần thiết do dữ liệu phải đi qua máy chủ trung gian ở xa, phụ thuộc hoàn toàn vào kết nối Internet (không hoạt động được khi mất kết nối), và đặc biệt là vấn đề bảo mật dữ liệu khi thông tin nhạy cảm phải đi qua các máy chủ bên ngoài.

Đối với các tổ chức có yêu cầu cao về bảo mật thông tin hoặc cần đảm bảo độ ổn định trong giao tiếp nội bộ, việc phụ thuộc vào các dịch vụ bên ngoài không phải là lựa chọn lý tưởng. Hơn nữa, trong môi trường mạng LAN với băng thông cao (thường 1 Gbps trở lên), việc định tuyến dữ liệu ra Internet rồi quay lại là một sự lãng phí tài nguyên và tạo ra độ trễ không cần thiết. Ngoài ra, nhiều tổ chức còn gặp khó khăn khi hệ thống Internet bị gián đoạn nhưng mạng LAN nội bộ vẫn hoạt động bình thường.

Từ những thực tế trên, ý tưởng xây dựng một ứng dụng chat thoại hoạt động hoàn toàn trong mạng LAN ra đời. Hệ thống này cho phép người dùng thực hiện cuộc gọi thoại và video theo nhóm (group call) hoặc trực tiếp 1-1 (direct call), xem danh sách người dùng đang trực tuyến trong thời gian thực, trao đổi tin nhắn văn bản trong cuộc gọi, và đặc biệt là duy trì cuộc gọi ổn định ngay cả khi người chủ trì (host) tạm thời mất kết nối thông qua cơ chế "hostless mode". Giải pháp này đảm bảo tự chủ hoàn toàn về dữ liệu, giảm thiểu độ trễ xuống mức thấp nhất có thể (thường dưới 100ms trong LAN), và có thể hoạt động độc lập không cần kết nối Internet.

## 2. Mục tiêu

Mục tiêu tổng thể của đề tài là xây dựng một hệ thống truyền thông thoại và video trong thời gian thực hoạt động trên mạng nội bộ LAN, hỗ trợ cả cuộc gọi nhóm với số lượng người tham gia lớn (tối đa 50 người) và cuộc gọi trực tiếp 1-1, đảm bảo chất lượng cao, độ trễ thấp và khả năng tự phục hồi khi gặp sự cố.

Để đạt được mục tiêu tổng thể trên, đề tài hướng đến các mục tiêu cụ thể sau đây. Về mặt kiến trúc hệ thống, phía backend sẽ được xây dựng trên nền tảng Node.js với Mediasoup SFU (Selective Forwarding Unit) để định tuyến luồng media hiệu quả, kết hợp Redis để lưu trữ trạng thái phòng và người dùng, đảm bảo tính bền vững của dữ liệu ngay cả khi máy chủ khởi động lại. Phía frontend sử dụng Electron kết hợp React để tạo ứng dụng desktop đa nền tảng (Windows, macOS, Linux), với Zustand làm công cụ quản lý trạng thái gọn nhẹ và hiệu quả. Lớp kết nối thời gian thực giữa client và server được thực hiện thông qua Socket.IO, đảm bảo khả năng tự động kết nối lại (auto-reconnect) và xử lý các sự kiện signaling một cách đáng tin cậy.

Về chức năng cốt lõi, hệ thống cần đáp ứng các yêu cầu sau:

- **Cuộc gọi nhóm (Group Call):** Người dùng có thể tạo phòng họp nhóm, mời nhiều thành viên cùng tham gia, với khả năng hỗ trợ tối đa 50 người tham gia đồng thời. Người tạo phòng trở thành host và có quyền quản lý cuộc gọi.

- **Cuộc gọi trực tiếp (Direct Call):** Hỗ trợ gọi trực tiếp giữa hai người dùng với luồng xử lý đơn giản, bao gồm các trạng thái gọi đến (incoming call), chấp nhận (accept), từ chối (reject), hủy (cancel) và timeout tự động sau 30 giây nếu không có phản hồi.

- **Chat trong cuộc gọi:** Tích hợp tính năng nhắn tin văn bản trong khi đang thực hiện cuộc gọi thoại/video, hỗ trợ trả lời tin nhắn (reply) và thả biểu tượng cảm xúc (emoji reactions) để tăng tính tương tác.

- **Hiển thị người dùng trực tuyến:** Theo dõi và cập nhật danh sách người dùng đang trực tuyến trong thời gian thực, cho phép người dùng dễ dàng khởi tạo cuộc gọi với bất kỳ ai đang hoạt động trên hệ thống.

- **Khả năng reconnect và Hostless Mode:** Khi host tạm thời mất kết nối, hệ thống duy trì cuộc gọi trong 30 giây (grace period) để host có thể kết nối lại. Nếu host không quay lại, phòng sẽ chuyển sang chế độ hostless, cho phép các thành viên còn lại tiếp tục cuộc gọi mà không bị gián đoạn.

- **Quản lý phòng và người tham gia:** Cung cấp giao diện quản lý danh sách phòng đang hoạt động, thông tin người tham gia, trạng thái micro/camera của từng người, và cho phép người dùng rời phòng hoặc kết thúc cuộc gọi một cách linh hoạt.

Các mục tiêu này được thiết kế nhằm tạo ra một giải pháp truyền thông nội bộ toàn diện, dễ sử dụng và đáng tin cậy, đặc biệt phù hợp với các tổ chức có yêu cầu cao về bảo mật và hiệu suất trong môi trường mạng LAN.
