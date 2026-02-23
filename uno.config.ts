import { defineConfig, presetUno, presetIcons } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons({
      scale: 1.2,
      extraProperties: {
        display: 'inline-block',
        'vertical-align': 'middle',
      },
    }),
  ],
  // Requirement: Non-technical users need a clean, modern look
  // Approach: Extend theme with brand colours for consistent budget-related visual cues
  theme: {
    colors: {
      brand: {
        50: '#ecfdf5',
        100: '#d1fae5',
        200: '#a7f3d0',
        300: '#6ee7b7',
        400: '#34d399',
        500: '#10b981',
        600: '#059669',
        700: '#047857',
        800: '#065f46',
        900: '#064e3b',
      },
      overspend: '#ef4444',
      underspend: '#22c55e',
      neutral: '#6b7280',
    },
  },
  shortcuts: {
    'btn': 'px-4 py-2 rounded-lg font-medium transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
    'btn-primary': 'btn bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700',
    'btn-secondary': 'btn bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300',
    'btn-danger': 'btn bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200',
    'input-field': 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
    'card': 'bg-white rounded-xl border border-gray-200 p-4 shadow-sm',
    'page-title': 'text-2xl font-bold text-gray-900',
    'section-title': 'text-lg font-semibold text-gray-800',
  },
})
