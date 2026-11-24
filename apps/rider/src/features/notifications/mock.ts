export interface AppNotification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
}

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    title: '🍱 Trưa rồi, bạn đã ăn gì chưa? 💚',
    body: '💼 Đừng để bụng đói làm việc! GoXe mang món ngon đến tận tay bạn 🛵',
    timestamp: '24/11 10:55',
  },
  {
    id: 'n2',
    title: '☀️ Sáng bận rộn, GoXe sẽ lo cùng bạn! 💚',
    body: '⏰ Sáng bận rộn, để GoXe san sẻ nhé! Chọn món yêu thích, GoXe giao tận nơi 🥖🛵',
    timestamp: '24/11 06:15',
  },
];
