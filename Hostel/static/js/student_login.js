// login.js (shared for both admin and student pages)
// This script listens for submission on each POST form and shows notifications.
// It is careful to show generic "Invalid credentials" if backend role does not match the form context.

document.addEventListener('DOMContentLoaded', () => {
  const loginForms = document.querySelectorAll('form[method="POST"]');

  loginForms.forEach(form => {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.innerHTML : null;

      if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        submitBtn.disabled = true;
      }

      try {
        const formData = new FormData(this);
        const response = await fetch(this.action, {
          method: 'POST',
          body: formData
        });

        // If response is not JSON, treat as failure
        let result = {};
        try {
          result = await response.json();
        } catch (err) {
          showNotification('Unexpected server response', 'error');
          return;
        }

        // result should contain success:boolean, message:string, role:string (optional), redirect:string (optional)
        // Protect against the scenario where the server returned an admin message to a student form:
        // If server returns role and it doesn't match this form (by looking at action), map the message to a generic one.
        const actionIsAdmin = this.action.includes('admin_login');
        const actionIsStudent = this.action.includes('student_login');

        if (result.role) {
          const roleIsAdmin = result.role === 'admin';
          const roleIsStudent = result.role === 'student';

          if (!((roleIsAdmin && actionIsAdmin) || (roleIsStudent && actionIsStudent))) {
            // mismatch: show generic message for invalid credentials
            if (!result.success) {
              showNotification('Invalid credentials', 'error');
            } else {
              // success but role mismatch is unlikely — treat as generic success
              showNotification(result.message || 'Success', 'success');
              if (result.redirect) window.location.href = result.redirect;
            }
            return;
          }
        }

        // Otherwise show message as-is
        if (result.success) {
          showNotification(result.message || 'Success', 'success');
          if (result.redirect) {
            setTimeout(() => {
              window.location.href = result.redirect;
            }, 800);
          }
        } else {
          showNotification(result.message || 'An error occurred', 'error');
        }

      } catch (err) {
        console.error(err);
        showNotification('An error occurred. Please try again.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
        }
      }
    });
  });
});

/* Minimal notification helper (uses your CSS .notification classes) */
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
