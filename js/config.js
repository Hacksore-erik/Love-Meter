/* ============================================================
   CONFIG — настройки приложения
   ============================================================
   Единственный файл, который вы редактируете вручную.

   Для локального режима (без синхронизации) оставьте
   CONFIG.SUPABASE.url и CONFIG.SUPABASE.anonKey пустыми.
   ============================================================ */

const CONFIG = {

  /* ==========================================================
     SUPABASE — синхронизация между партнёрами
     ========================================================== */
  SUPABASE: {
    url: 'https://ogmjcqwhnxplfgwyjywg.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nbWpjcXdobnhwbGZnd3lqeXdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNjcyNjAsImV4cCI6MjEwNTY0MzI2MH0.yrhcqo9pSfyN8bIBnLBP66VcuXGVlWhmHp9vsbwl9JU'
  },

  /* ==========================================================
     КЛЮЧИ LOCALSTORAGE
     ========================================================== */
  STORAGE: {
    state: 'lovemeter_v4',
    myId: 'lovemeter_myid_v4',
    couple: 'lovemeter_couple_v4',
    creator: 'lovemeter_creator_of_'
  },

  /* ==========================================================
     ЗНАЧЕНИЯ ПО УМОЛЧАНИЮ
     ========================================================== */
  DEFAULTS: {
    names: 'Моя пара',
    hideMyVotes: false
  },

  /* ==========================================================
     ЦВЕТА УРОВНЕЙ НАСТРОЕНИЯ
     ========================================================== */
  MOODS: [
    '#b8bcc7',
    '#7aa7ff',
    '#b98aff',
    '#ff7da1',
    '#ff2d55'
  ],

  /* ==========================================================
     ДОСТИЖЕНИЯ
     ========================================================== */
  ACHIEVEMENTS: [
    { id: 'first', emoji: '🌱', name: 'Первый шаг', desc: 'Поставить первую оценку', max: 1 },
    { id: 'week', emoji: '🔥', name: 'Неделя огня', desc: '7 дней подряд', max: 7 },
    { id: 'month', emoji: '💎', name: 'Месяц силы', desc: '30 дней подряд', max: 30 },
    { id: 'perfect', emoji: '💯', name: 'Идеальный день', desc: 'Оба поставили 5', max: 1 },
    { id: 'romantic', emoji: '💌', name: 'Романтик', desc: '10 дней с оценкой 5', max: 10 },
    { id: 'historian', emoji: '📖', name: 'Историк', desc: '100 дней в приложении', max: 100 },
    { id: 'rainbow', emoji: '🌈', name: 'Радуга', desc: 'Все 5 уровней за неделю', max: 5 },
    { id: 'sync', emoji: '🤝', name: 'Синхрон', desc: '14 дней совпадения оценок', max: 14 },
    { id: 'burning', emoji: '❤️‍🔥', name: 'Пылающее сердце', desc: 'Сердце >90% неделю', max: 7 },
    { id: 'anniversary', emoji: '🎂', name: 'Годовщина', desc: '365 дней в приложении', max: 365 }
  ]
};

/* ============================================================
   ФЛАГ: доступен ли Supabase
   ============================================================ */
const HAS_SUPABASE = !!(CONFIG.SUPABASE.url && CONFIG.SUPABASE.anonKey);