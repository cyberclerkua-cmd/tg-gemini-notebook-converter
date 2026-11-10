'use strict';
/**
 * Общие фикстуры для тестов: синтетический экспорт Telegram.
 */
function sampleExport() {
  return {
    name: 'Тестовый чат',
    type: 'personal_chat',
    id: 42,
    messages: [
      { id: 1, type: 'message', date: '2020-02-14T10:00:00', from: 'Алиса', from_id: 'user1', text: 'Первое сообщение' },
      { id: 2, type: 'message', date: '2020-02-14T10:05:00', from: 'Борис', from_id: 'user2', text: ['Вторая ', { type: 'link', text: 'часть' }, ' ссылки'], reply_to_message_id: 1 },
      { id: 3, type: 'service', date: '2020-02-14T10:06:00', actor: 'Алиса', actor_id: 'user1', action: 'create_group', title: 'Тестовый чат' },
      { id: 4, type: 'message', date: '2020-02-14T10:10:00', from: 'Алиса', from_id: 'user1', text: 'Голосование', poll: {
        question: 'Что выбрать?',
        total_voters: 3,
        answers: [
          { text: 'Да', voters: 2 },
          { text: 'Нет', voters: 1 }
        ]
      } },
      { id: 5, type: 'message', date: '2020-02-14T10:15:00', from: 'Борис', from_id: 'user2', text: 'Ок', reactions: [ { emoji: '👍', count: 4 }, { emoji: '🔥', count: 1 } ] },
      { id: 6, type: 'message', date: '2020-02-14T10:20:00', from: 'Аноним', from_id: 'user3', text: 'Пересланное', forwarded_from: 'Канал Новостей' },
      { id: 7, type: 'message', date: '2020-02-14T10:25:00', from: 'Алиса', from_id: 'user1', text: '' }
    ]
  };
}

module.exports = { sampleExport };
