/**
 * public/js/main.js
 * -----------------------------------------------------------------
 * Shared client-side behavior: mobile sidebar toggle, dark mode
 * switching (persisted to the DB via /profile/dark-mode), delete
 * confirmations, auto-dismissing flash alerts, and profile picture
 * upload/removal (instant preview, no page reload).
 * -----------------------------------------------------------------
 */

// Register the PWA service worker (enables "Add to Home Screen").
// Not tied to DOMContentLoaded — the spec recommends waiting for the
// load event so registration doesn't compete with page resources.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}

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
  // "Add to Home Screen" banner (Daily Budget page — the page most
  // students want one-tap access to). Hidden on desktop, once the
  // app is already installed, or after the user dismisses it once.
  // ---------------------------------------------------------------
  const a2hsBanner = document.getElementById('a2hsBanner');
  if (a2hsBanner) {
    const DISMISS_KEY = 'finwell_a2hs_dismissed';
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    let isDismissed = false;
    try { isDismissed = localStorage.getItem(DISMISS_KEY) === 'true'; } catch (e) { /* private mode etc. */ }

    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isAndroid = /Android/.test(ua);

    if (!isStandalone && !isDismissed && (isIOS || isAndroid)) {
      a2hsBanner.style.display = '';
      const textEl = document.getElementById('a2hsText');
      const installBtn = document.getElementById('a2hsInstallBtn');

      if (textEl) {
        textEl.textContent = isIOS
          ? 'Tap the Share icon, then "Add to Home Screen" — it opens straight to this page.'
          : 'Tap the ⋮ menu, then "Add to Home screen" (or use Install below if it appears).';
      }

      let deferredPrompt = null;
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installBtn) installBtn.style.display = '';
      });

      if (installBtn) {
        installBtn.addEventListener('click', async () => {
          if (!deferredPrompt) return;
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
          deferredPrompt = null;
          installBtn.style.display = 'none';
        });
      }
    }

    const dismissBtn = document.getElementById('a2hsDismissBtn');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        a2hsBanner.style.display = 'none';
        try { localStorage.setItem(DISMISS_KEY, 'true'); } catch (e) { /* private mode etc. */ }
      });
    }
  }

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
  // Profile picture: click avatar to change, instant local preview,
  // AJAX upload (no page reload), and a remove option. Keeps the
  // topbar avatar in sync with the one on the profile page.
  // ---------------------------------------------------------------
  const avatarPreview = document.getElementById('avatarPreview');
  const avatarInput = document.getElementById('profilePictureInput');
  const avatarSpinner = document.getElementById('avatarSpinner');
  const avatarError = document.getElementById('avatarError');
  const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

  function showAvatarError(message) {
    if (!avatarError) return;
    avatarError.textContent = message;
    avatarError.style.display = 'block';
  }

  function clearAvatarError() {
    if (!avatarError) return;
    avatarError.style.display = 'none';
  }

  function setAvatarImage(src) {
    if (avatarPreview) {
      avatarPreview.querySelectorAll('img, .avatar-initials').forEach((el) => el.remove());
      const img = document.createElement('img');
      img.id = 'avatarImg';
      img.alt = 'Profile';
      img.src = src;
      avatarPreview.prepend(img);
    }

    const topImg = document.getElementById('topbarAvatarImg');
    const topInitials = document.getElementById('topbarAvatarInitials');
    if (topImg) {
      topImg.src = src;
    } else if (topInitials) {
      const img = document.createElement('img');
      img.id = 'topbarAvatarImg';
      img.className = 'avatar-circle';
      img.alt = 'Profile';
      img.src = src;
      topInitials.replaceWith(img);
    }
  }

  function setAvatarInitials(letter) {
    if (avatarPreview) {
      avatarPreview.querySelectorAll('img, .avatar-initials').forEach((el) => el.remove());
      const div = document.createElement('div');
      div.id = 'avatarInitials';
      div.className = 'avatar-initials';
      div.textContent = letter;
      avatarPreview.prepend(div);
    }

    const topImg = document.getElementById('topbarAvatarImg');
    if (topImg) {
      const div = document.createElement('div');
      div.id = 'topbarAvatarInitials';
      div.className = 'avatar-circle';
      div.textContent = letter;
      topImg.replaceWith(div);
    }

    const removeBtn = document.getElementById('removePictureBtn');
    if (removeBtn) removeBtn.remove();
  }

  function ensureRemoveButton() {
    if (document.getElementById('removePictureBtn') || !avatarPreview) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'removePictureBtn';
    btn.className = 'btn btn-link btn-sm text-danger p-0';
    btn.innerHTML = '<i class="fa-solid fa-trash me-1"></i>Remove Photo';
    btn.addEventListener('click', handleRemovePicture);
    avatarPreview.parentElement.appendChild(btn);
  }

  async function handleRemovePicture() {
    if (!confirm('Remove your profile picture?')) return;
    clearAvatarError();
    try {
      const res = await fetch('/profile/remove-picture', {
        method: 'POST',
        headers: { Accept: 'application/json' }
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error('Failed to remove picture.');
      const letter = avatarPreview ? avatarPreview.getAttribute('data-user-initial') || '?' : '?';
      setAvatarInitials(letter);
    } catch (err) {
      showAvatarError(err.message || 'Failed to remove picture.');
    }
  }

  if (avatarPreview && avatarInput) {
    avatarPreview.addEventListener('click', () => avatarInput.click());

    avatarInput.addEventListener('change', async () => {
      const file = avatarInput.files[0];
      if (!file) return;

      clearAvatarError();

      if (file.size > MAX_AVATAR_BYTES) {
        showAvatarError('Image must be smaller than 2MB.');
        avatarInput.value = '';
        return;
      }

      // Instant local preview — swap it in before the network request
      // even finishes, so it feels immediate.
      const reader = new FileReader();
      reader.onload = () => setAvatarImage(reader.result);
      reader.readAsDataURL(file);

      if (avatarSpinner) avatarSpinner.classList.remove('d-none');

      try {
        const formData = new FormData();
        formData.append('profilePicture', file);
        const res = await fetch('/profile/upload-picture', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: formData
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Upload failed.');
        setAvatarImage(data.profilePicture);
        ensureRemoveButton();
      } catch (err) {
        showAvatarError(err.message || 'Failed to upload image.');
      } finally {
        if (avatarSpinner) avatarSpinner.classList.add('d-none');
        avatarInput.value = '';
      }
    });
  }

  const removePictureBtn = document.getElementById('removePictureBtn');
  if (removePictureBtn) {
    removePictureBtn.addEventListener('click', handleRemovePicture);
  }

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
