/**
 * public/js/main.js
 * -----------------------------------------------------------------
 * Shared client-side behavior: mobile sidebar toggle, dark mode
 * switching (persisted to the DB via /profile/dark-mode), delete
 * confirmations, and auto-dismissing flash alerts.
 * -----------------------------------------------------------------
 */

document.addEventListener('DOMContentLoaded', () => {
  // ---------------------------------------------------------------
  // Mobile sidebar toggle
  // ---------------------------------------------------------------
  const sidebar = document.getElementById('appSidebar');
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  const overlay = document.getElementById('sidebarOverlay');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('d-none');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.add('d-none');
    });
  }

  // ---------------------------------------------------------------
  // Dark mode toggle
  // ---------------------------------------------------------------
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', async () => {
      const html = document.documentElement;
      const isDark = html.getAttribute('data-theme') === 'dark';
      const newState = !isDark;
      html.setAttribute('data-theme', newState ? 'dark' : 'light');
      themeToggle.innerHTML = newState ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';

      try {
        await fetch('/profile/dark-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: newState })
        });
      } catch (err) {
        console.error('Failed to persist dark mode preference:', err);
      }
    });
  }

  // ---------------------------------------------------------------
  // Delete confirmation for any form with .confirm-delete
  // ---------------------------------------------------------------
  document.querySelectorAll('.confirm-delete').forEach((form) => {
    form.addEventListener('submit', (e) => {
      const label = form.getAttribute('data-label') || 'this record';
      if (!confirm(`Are you sure you want to delete ${label}? This action cannot be undone.`)) {
        e.preventDefault();
      }
    });
  });

  // ---------------------------------------------------------------
  // Auto-dismiss flash alerts after 5 seconds
  // ---------------------------------------------------------------
  document.querySelectorAll('.alert-auto-dismiss').forEach((alertEl) => {
    setTimeout(() => {
      alertEl.classList.add('fade');
      alertEl.classList.remove('show');
      setTimeout(() => alertEl.remove(), 300);
    }, 5000);
  });

  // ---------------------------------------------------------------
  // Animate health score gauge fill on load
  // ---------------------------------------------------------------
  const gaugeFill = document.querySelector('.gauge-fill');
  if (gaugeFill) {
    const score = parseFloat(gaugeFill.getAttribute('data-score') || '0');
    const circumference = parseFloat(gaugeFill.getAttribute('data-circumference') || '408');
    const offset = circumference - (score / 100) * circumference;
    requestAnimationFrame(() => {
      gaugeFill.style.strokeDasharray = `${circumference}`;
      gaugeFill.style.strokeDashoffset = `${offset}`;
    });
  }
});
