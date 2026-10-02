export const THEME_KEY = "mealbook-theme";
// Runs before the page paints; a device preference stays independent of login.
export const themeScript = `(function(){var theme;try{theme=localStorage.getItem('mealbook-theme')}catch(e){}if(theme!=='dark'&&theme!=='light')theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=theme})()`;
