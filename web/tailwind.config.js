/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#F4F0E9',
        bgElev: '#FBF8F3',
        surface: '#FFFDFA',
        surfaceAlt: '#F0EBE1',
        text: '#2B2722',
        text2: '#7C7468',
        text3: '#A89F92',
        accent: '#CE7F44',
        accentDeep: '#B96B33',
        accentSoft: '#F5E7D5',
        darkBg: '#16130E',
        darkText: '#F3EEE4',
        darkText2: '#A89E8F',
        darkSurface: '#221E18',
        dimIntellect: '#4A7FD4',
        dimSpirit: '#9B72CF',
        dimEmotion: '#E8748A',
        dimArt: '#7DBF72',
      },
      fontFamily: {
        serif: ['Newsreader', 'New York', 'ui-serif', 'Georgia', 'serif'],
        sans: ['-apple-system', 'SF Pro Text', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        card: '24px',
        btn: '14px',
      },
      maxWidth: {
        content: '1100px',
      },
    },
  },
  plugins: [],
}
