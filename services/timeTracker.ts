import { Task } from '../types';

export const TimeTracker = {
  /**
   * Menghitung total waktu (detik) dari Task.
   * Rumus: Waktu Tersimpan (Completed) + Waktu Berjalan (Active Session)
   */
  calculateTotalSeconds: (task: Task): number => {
    let activeSeconds = 0;
    const now = Date.now();

    // Pastikan timerSessions adalah object valid
    if (task.timerSessions && typeof task.timerSessions === 'object') {
      Object.values(task.timerSessions).forEach((startTime) => {
        const start = Number(startTime);
        // Validasi: Start time harus angka valid dan tidak di masa depan
        if (!isNaN(start) && start > 0 && start <= now) {
          activeSeconds += (now - start) / 1000;
        }
      });
    }

    const baseTime = Number(task.timeSpent) || 0;
    return Math.floor(baseTime + activeSeconds);
  },

  /**
   * Memulai Sesi Timer untuk User
   * Mengembalikan object Task baru dengan timerSessions yang diperbarui
   */
  startSession: (task: Task, userId: string): Task => {
    const now = Date.now();
    const newSessions = { ...(task.timerSessions || {}) };
    
    // Set timestamp mulai (ini yang akan ditulis ke sheet sebagai start_time)
    newSessions[userId] = now;

    // Pastikan user masuk ke activeUserIds
    const newActiveUsers = task.activeUserIds.includes(userId) 
      ? task.activeUserIds 
      : [...task.activeUserIds, userId];

    return {
      ...task,
      timerSessions: newSessions,
      activeUserIds: newActiveUsers
    };
  },

  /**
   * Menghentikan Sesi Timer
   * Menghitung selisih (Waktu Selesai - Waktu Mulai) dan menambahkannya ke timeSpent
   */
  stopSession: (task: Task, userId: string): Task => {
    const now = Date.now();
    const newSessions = { ...(task.timerSessions || {}) };
    const startTime = Number(newSessions[userId]);
    
    let addedTime = 0;

    // Jika ada sesi valid, hitung durasinya
    if (!isNaN(startTime) && startTime > 0) {
      addedTime = (now - startTime) / 1000; // Konversi ke detik
      delete newSessions[userId]; // Hapus sesi (kosongi timestamp aktif)
    }

    // Hapus user dari active list
    const newActiveUsers = task.activeUserIds.filter(id => id !== userId);

    return {
      ...task,
      timeSpent: (task.timeSpent || 0) + addedTime, // Update total waktu tersimpan
      timerSessions: newSessions,
      activeUserIds: newActiveUsers
    };
  }
};