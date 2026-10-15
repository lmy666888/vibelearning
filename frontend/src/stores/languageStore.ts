import { create } from 'zustand';
export type Language = 'zh-CN' | 'en';
export const useLanguageStore = create<{ language: Language; setLanguage: (language: Language) => void }>(set => ({
  language: 'en', setLanguage: language => set({ language }),
}));
