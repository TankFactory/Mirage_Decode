import { create } from 'zustand';

type ThemeMode = 'light' | 'dark';

/*
LICENSE of Catppuccin Palette (Latte and Mocha):

  MIT License

  Copyright (c) 2021 Catppuccin

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.

 */

type Palette = {
  Rosewater: string;
  Flamingo: string;
  Pink: string;
  Mauve: string;
  Red: string;
  Maroon: string;
  Peach: string;
  Yellow: string;
  Green: string;
  Teal: string;
  Sky: string;
  Sapphire: string;
  Blue: string;
  Lavender: string;

  SecondaryBackground: string;
  Background: string;
  SecondaryNotselectedBackground: string;
  ElementBackground: string;
};

export const PaletteEntries = [
  'Lavender',
  'Blue',
  'Sapphire',
  'Sky',
  'Teal',
  'Green',
  'Yellow',
  'Peach',
  'Maroon',
  'Red',
  'Mauve',
  'Pink',
  'Flamingo',
  'Rosewater',
];

// Catppuccin Latte Palette, for light mode
const lightPalette: Palette = {
  Rosewater: '#dc8a78',
  Flamingo: '#dd7878',
  Pink: '#ea76cb',
  Mauve: '#8839ef',
  Red: '#d20f39',
  Maroon: '#e64553',
  Peach: '#fe640b',
  Yellow: '#df8e1d',
  Green: '#40a02b',
  Teal: '#179299',
  Sky: '#04a5e5',
  Sapphire: '#209fb5',
  Blue: '#1e66f5',
  Lavender: '#7287fd',

  SecondaryBackground: '#fff',
  Background: '#ececec',
  SecondaryNotselectedBackground: '#f6f6f6',
  ElementBackground: '#f6f6f6',
};

// Catppuccin Mocha Palette, for dark mode
const darkPalette: Palette = {
  Rosewater: '#f5e0dc',
  Flamingo: '#f2cdcd',
  Pink: '#f5c2e7',
  Mauve: '#cba6f7',
  Red: '#f38ba8',
  Maroon: '#eba0ac',
  Peach: '#fab387',
  Yellow: '#f9e2af',
  Green: '#a6e3a1',
  Teal: '#94e2d5',
  Sky: '#89dceb',
  Sapphire: '#74c7ec',
  Blue: '#89b4fa',
  Lavender: '#b4befe',

  SecondaryBackground: '#000',
  Background: '#191919',
  SecondaryNotselectedBackground: '#101010',
  ElementBackground: '#444',
};

type ThemeStore = {
  mode: ThemeMode;
  primaryColor: string;
  secondaryColor: string;
  palette: Palette;
  toggleTheme: () => void;
  setPrimaryColor: (color: string) => void;
  setSecondaryColor: (color: string) => void;
};

const localThemeKey = 'theme-mode';

const useThemeStore = create<ThemeStore>((set) => ({
  mode: getInitialMode(),
  primaryColor: '#89b3fa',
  secondaryColor: '#388e3c',
  palette: lightPalette,
  toggleTheme: () => {
    set((state) => {
      const newMode = state.mode === 'light' ? 'dark' : 'light';
      updateThemeMode(newMode);
      return { mode: newMode };
    });
  },
  setPrimaryColor: (color) => {
    set({ primaryColor: color });
  },
  setSecondaryColor: (color) => {
    set({ secondaryColor: color });
  },
  setPaletteSupplement: (paletteSupplement: Palette) => {
    set({ palette: paletteSupplement });
  },
}));

function getInitialMode(): ThemeMode {
  const stored = localStorage.getItem(localThemeKey);
  if (stored === 'light' || stored === 'dark') return stored;
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function updateThemeMode(mode: ThemeMode) {
  if (mode === 'dark') {
    if (!document.body.classList.contains('dark')) {
      document.body.classList.add('dark');
    }
  } else {
    if (document.body.classList.contains('dark')) {
      document.body.classList.remove('dark');
    }
  }
  localStorage.setItem(localThemeKey, mode);
  useThemeStore.setState({
    mode,
    palette: mode === 'light' ? lightPalette : darkPalette,
    primaryColor: mode === 'light' ? lightPalette.Blue : darkPalette.Blue,
    secondaryColor: mode === 'light' ? lightPalette.Green : darkPalette.Green,
  });
}

// sync <body> class and palette with the resolved mode before anything renders
updateThemeMode(useThemeStore.getState().mode);

export { localThemeKey, useThemeStore };
