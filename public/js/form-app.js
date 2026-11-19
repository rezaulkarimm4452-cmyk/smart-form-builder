/**
 * Public Registration Form Application Logic
 * Dynamically builds form fields and handles seamless submissions
 */

document.addEventListener('DOMContentLoaded', () => {
  const formContainer = document.getElementById('form-dynamic-container');
  const loadingState = document.getElementById('form-loading-state');
  const inactiveState = document.getElementById('form-inactive-state');
  const successState = document.getElementById('form-success-state');
  const formElement = document.getElementById('public-registration-form');

  let currentConfig = null;
  const customSelectInstances = {};

  // Toast Notification Helper
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconSvg = type === 'success' 
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

    toast.innerHTML = `
      <span class="toast-icon">${iconSvg}</span>
      <div class="toast-body">${escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Load Form Configuration
  async function loadFormConfig() {
    try {
      loadingState.style.display = 'block';
      formContainer.style.display = 'none';
      inactiveState.style.display = 'none';
      successState.style.display = 'none';

      const res = await fetch('/api/form-config');
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || 'কনফিগারেশন লোড করা সম্ভব হয়নি');
      }

      currentConfig = data;
      loadingState.style.display = 'none';

      if (!data.settings.is_active) {
        inactiveState.style.display = 'block';
        return;
      }

      renderForm(data.settings, data.fields);
      formContainer.style.display = 'block';
    } catch (err) {
      console.error('Error loading form config:', err);
      loadingState.style.display = 'none';
      showToast('ফর্ম লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে পেজটি রিফ্রেশ করুন।', 'error');
    }
  }

  // Render Form Header & Dynamic Question Cards
  function renderForm(settings, fields) {
    // Set Header
    document.getElementById('form-title-text').textContent = settings.title || 'অনলাইন আবেদন ফর্ম';
    document.getElementById('form-desc-text').textContent = settings.description || '';

    // Render Fields
    const fieldsListContainer = document.getElementById('dynamic-fields-wrapper');
    fieldsListContainer.innerHTML = '';

    fields.forEach((field, index) => {
      const card = document.createElement('div');
      card.className = 'form-question-card';
      card.dataset.fieldId = field.id;

      const group = document.createElement('div');
      group.className = 'form-group';

      // Label
      const label = document.createElement('label');
      label.className = 'form-label';
      label.htmlFor = `input_${field.id}`;
      label.innerHTML = `
        <span>${escapeHtml(field.label)}</span>
        ${field.required ? '<span class="required-mark">*</span>' : ''}
      `;
      group.appendChild(label);

      // Input Control based on Field Type
      let inputElement;

      if (field.type === 'select') {
        // CUSTOM DROPDOWN (Strictly NO native select)
        const customSelectContainer = document.createElement('div');
        customSelectContainer.id = `select_container_${field.id}`;
        group.appendChild(customSelectContainer);

        card.appendChild(group);
        fieldsListContainer.appendChild(card);

        // Format options for CustomSelect
        const formattedOptions = (field.options || []).map(opt => ({
          label: opt,
          value: opt
        }));

        const csInstance = new CustomSelect(customSelectContainer, {
          name: field.id,
          placeholder: field.placeholder || 'একটি বিকল্প নির্বাচন করুন...',
          required: Boolean(field.required),
          options: formattedOptions
        });

        customSelectInstances[field.id] = csInstance;
        return;
      } else if (field.type === 'textarea') {
        inputElement = document.createElement('textarea');
        inputElement.id = `input_${field.id}`;
        inputElement.name = field.id;
        inputElement.className = 'form-textarea';
        inputElement.placeholder = field.placeholder || 'এখানে বিস্তারিত লিখুন...';
        if (field.required) inputElement.required = true;
        group.appendChild(inputElement);
      } else if (field.type === 'radio') {
        const radioGroup = document.createElement('div');
        radioGroup.className = 'custom-options-group';
        radioGroup.setAttribute('role', 'radiogroup');

        (field.options || []).forEach((opt, optIdx) => {
          const radioItem = document.createElement('label');
          radioItem.className = 'custom-radio-item';

          const radioInput = document.createElement('input');
          radioInput.type = 'radio';
          radioInput.name = field.id;
          radioInput.value = opt;
          if (field.required && optIdx === 0) {
            radioInput.required = true;
          }

          const radioLabel = document.createElement('span');
          radioLabel.textContent = opt;

          radioItem.appendChild(radioInput);
          radioItem.appendChild(radioLabel);
          radioGroup.appendChild(radioItem);
        });

        group.appendChild(radioGroup);
      } else {
        // Standard inputs: text, email, number, tel, date
        inputElement = document.createElement('input');
        inputElement.id = `input_${field.id}`;
        inputElement.type = field.type || 'text';
        inputElement.name = field.id;
        inputElement.className = 'form-input';
        inputElement.placeholder = field.placeholder || '';
        if (field.required) inputElement.required = true;
        group.appendChild(inputElement);
      }

      card.appendChild(group);
      fieldsListContainer.appendChild(card);
    });
  }

  // Handle Form Submission
  formElement.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('btn-submit-form');
    const originalBtnText = submitBtn.innerHTML;

    // Collect Data
    const formData = new FormData(formElement);
    const payload = {};

    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        payload[key] = value.trim();
      } else {
        payload[key] = value;
      }
    }

    // Include custom select values explicitly
    for (const [fieldId, csInstance] of Object.entries(customSelectInstances)) {
      payload[fieldId] = csInstance.getValue();
    }

    // Client-side Validation Check
    const missing = [];
    if (currentConfig && currentConfig.fields) {
      for (const field of currentConfig.fields) {
        if (field.required) {
          const val = payload[field.id];
          if (!val || (typeof val === 'string' && val.trim() === '')) {
            missing.push(field.label);
          }
        }
      }
    }

    if (missing.length > 0) {
      showToast(`আবশ্যক ফিল্ডগুলো পূরণ করুন: ${missing[0]}`, 'error');
      // Highlight card
      const firstMissing = currentConfig.fields.find(f => f.required && !payload[f.id]);
      if (firstMissing) {
        const card = document.querySelector(`[data-field-id="${firstMissing.id}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.style.borderColor = '#dc2626';
          setTimeout(() => { card.style.borderColor = ''; }, 3000);
        }
      }
      return;
    }

    // Set Loading state on button
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <div style="width: 18px; height: 18px; border: 2.5px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite;"></div>
      <span>জমা দেওয়া হচ্ছে...</span>
    `;

    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload })
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || 'আবেদন জমা দেওয়া যায়নি।');
      }

      // Success
      showSuccessView(result.submission_code, payload);
      showToast('আপনার আবেদন সফলভাবে সম্পন্ন হয়েছে!', 'success');
    } catch (err) {
      console.error('Submission error:', err);
      showToast(err.message || 'একটি ত্রুটি ঘটেছে। পুনরায় চেষ্টা করুন।', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });

  // Show Success Screen
  function showSuccessView(submissionCode, submittedData) {
    formContainer.style.display = 'none';
    successState.style.display = 'block';

    const codeEl = document.getElementById('display-submission-code');
    if (codeEl) codeEl.textContent = submissionCode;

    // Render Preview of Submitted Data
    const previewContainer = document.getElementById('submission-summary-preview');
    if (previewContainer && currentConfig && currentConfig.fields) {
      previewContainer.innerHTML = '';
      currentConfig.fields.forEach(field => {
        const val = submittedData[field.id];
        if (val) {
          const row = document.createElement('div');
          row.style.cssText = 'display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; font-size: 0.925rem;';
          row.innerHTML = `
            <span style="color: var(--text-muted); font-weight: 500;">${escapeHtml(field.label)}:</span>
            <span style="color: var(--text-main); font-weight: 600; text-align: right; max-width: 60%;">${escapeHtml(val)}</span>
          `;
          previewContainer.appendChild(row);
        }
      });
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Copy Code Button
  const copyBtn = document.getElementById('btn-copy-code');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const code = document.getElementById('display-submission-code').textContent;
      navigator.clipboard.writeText(code).then(() => {
        showToast('কোডটি ক্লিপবোর্ডে কপি করা হয়েছে!', 'success');
      }).catch(() => {
        showToast('কপি করতে ব্যর্থ হয়েছে', 'error');
      });
    });
  }

  // Submit Another Response Button
  const btnSubmitAnother = document.getElementById('btn-submit-another');
  if (btnSubmitAnother) {
    btnSubmitAnother.addEventListener('click', () => {
      formElement.reset();
      Object.values(customSelectInstances).forEach(cs => cs.setValue(''));
      successState.style.display = 'none';
      formContainer.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Clear Form Button
  const btnClear = document.getElementById('btn-clear-form');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (confirm('আপনি কি নিশ্চিত যে ফর্মের সব তথ্য মুছে ফেলতে চান?')) {
        formElement.reset();
        Object.values(customSelectInstances).forEach(cs => cs.setValue(''));
        showToast('ফর্মটি রিসেট করা হয়েছে', 'success');
      }
    });
  }

  // Initial Fetch
  loadFormConfig();
});
