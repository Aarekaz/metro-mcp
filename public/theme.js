// Color theme: "system" (the default, follows the OS) or an explicit "light" /
// "dark" pick saved in this browser. Loaded in <head> so the saved pick lands
// before first paint; CSS reads :root[data-theme].
(() => {
  const KEY = 'transit-mcp-theme';
  const CHOICES = ['system', 'light', 'dark'];
  const LABELS = { system: 'System', light: 'Light', dark: 'Dark' };
  const root = document.documentElement;

  const readChoice = () => {
    try {
      const saved = localStorage.getItem(KEY);
      return CHOICES.includes(saved) ? saved : 'system';
    } catch {
      return 'system';
    }
  };

  const saveChoice = (choice) => {
    try {
      if (choice === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch {
      // Storage blocked: the pick still applies for this page view.
    }
  };

  const applyChoice = (choice) => {
    root.dataset.themeChoice = choice;
    if (choice === 'system') delete root.dataset.theme;
    else root.dataset.theme = choice;
  };

  applyChoice(readChoice());

  const wire = () => {
    const switcher = document.querySelector('.theme-switch');
    if (!switcher) return;
    const button = switcher.querySelector('.theme-button');
    const menu = switcher.querySelector('.theme-menu');
    const items = [...menu.querySelectorAll('[data-theme-choice]')];

    const sync = () => {
      const choice = root.dataset.themeChoice;
      button.setAttribute('aria-label', `Color theme: ${LABELS[choice]}`);
      button.title = `Theme: ${LABELS[choice]}`;
      for (const item of items) {
        item.setAttribute('aria-checked', String(item.dataset.themeChoice === choice));
      }
    };

    const close = ({ focusButton = false } = {}) => {
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      if (focusButton) button.focus();
    };

    const open = () => {
      menu.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      (items.find((item) => item.getAttribute('aria-checked') === 'true') ?? items[0]).focus();
    };

    button.addEventListener('click', () => (menu.hidden ? open() : close()));

    for (const item of items) {
      item.addEventListener('click', () => {
        const choice = item.dataset.themeChoice;
        applyChoice(choice);
        saveChoice(choice);
        sync();
        close({ focusButton: true });
      });
    }

    menu.addEventListener('keydown', (event) => {
      const index = items.indexOf(document.activeElement);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        items[(index + step + items.length) % items.length].focus();
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        items[event.key === 'Home' ? 0 : items.length - 1].focus();
      } else if (event.key === 'Escape') {
        close({ focusButton: true });
      } else if (event.key === 'Tab') {
        close();
      }
    });

    document.addEventListener('click', (event) => {
      if (!menu.hidden && !switcher.contains(event.target)) close();
    });

    sync();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire, { once: true });
  } else {
    wire();
  }
})();
