// login.js - Admin Login Handler
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('adminForm');

  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.innerHTML : null;

      if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        submitBtn.disabled = true;
      }

      try {
        const formData = new FormData(this);
        const response = await fetch(this.action, {
          method: 'POST',
          body: formData
        });

        let result = {};
        try {
          result = await response.json();
        } catch (err) {
          showNotification('Unexpected server response', 'error');
          return;
        }

        if (result.success) {
          showNotification(result.message || 'Login successful!', 'success');
          if (result.redirect) {
            setTimeout(() => {
              window.location.href = result.redirect;
            }, 1000);
          }
        } else {
          // Show generic message for security
          showNotification('Invalid admin credentials', 'error');
        }

      } catch (err) {
        console.error(err);
        showNotification('Network error. Please try again.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
        }
      }
    });
  }
});

/* Notification helper */
function showNotification(message, type = 'info') {
  let container = document.querySelector('.notification-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'notification-container';
    document.body.appendChild(container);
  }

  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
    <span>${message}</span>
    <button class="notification-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
  `;
  container.appendChild(notification);

  setTimeout(() => {
    if (notification.parentElement) notification.remove();
  }, 5000);
}
