/**
 * Admin Panel Dashboard & Form Builder Logic
 * Handles real-time submissions review, field configurations, and dynamic updates
 */

document.addEventListener('DOMContentLoaded', () => {
  // Navigation Tabs
  const tabSubmissionsBtn = document.getElementById('tab-btn-submissions');
  const tabBuilderBtn = document.getElementById('tab-btn-builder');
  const sectionSubmissions = document.getElementById('section-submissions');
  const sectionBuilder = document.getElementById('section-builder');

  // Modals
  const fieldModalBackdrop = document.getElementById('field-modal-backdrop');
  const detailsModalBackdrop = document.getElementById('details-modal-backdrop');

  // State
  let formSettings = { title: '', description: '', is_active: true };
  let formFields = [];
  let currentEditingFieldIndex = -1; // -1 means adding new
  let fieldTypeSelectInstance = null;

  // Toast Notification
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
    }, 3500);
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

  // Tab Switching
  tabSubmissionsBtn.addEventListener('click', () => {
    tabSubmissionsBtn.classList.add('active');
    tabBuilderBtn.classList.remove('active');
    sectionSubmissions.style.display = 'block';
    sectionBuilder.style.display = 'none';
    loadSubmissions();
  });

  tabBuilderBtn.addEventListener('click', () => {
    tabBuilderBtn.classList.add('active');
    tabSubmissionsBtn.classList.remove('active');
    sectionBuilder.style.display = 'block';
    sectionSubmissions.style.display = 'none';
    loadFormConfig();
  });

  // =========================================================================
  // SUBMISSIONS MANAGEMENT
  // =========================================================================
  const searchInput = document.getElementById('search-submissions-input');
  let searchDebounceTimeout = null;

  async function loadSubmissions() {
    try {
      const search = (searchInput.value || '').trim();
      const res = await fetch(`/api/submissions?search=${encodeURIComponent(search)}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || 'আবেদনসমূহ লোড করা সম্ভব হয়নি');
      }

      // Update Stats
      document.getElementById('stat-total-submissions').textContent = data.stats.totalSubmissions;
      document.getElementById('stat-today-submissions').textContent = data.stats.todaySubmissions;
      
      const statusBadge = document.getElementById('stat-status-badge');
      if (data.stats.isActive) {
        statusBadge.className = 'badge badge-success';
        statusBadge.innerHTML = '<span class="badge-dot"></span> সক্রিয়';
      } else {
        statusBadge.className = 'badge badge-danger';
        statusBadge.innerHTML = '<span class="badge-dot"></span> বন্ধ রয়েছে';
      }

      document.getElementById('stat-fields-count').textContent = data.stats.fieldsCount;

      renderSubmissionsTable(data.submissions, data.fields);
    } catch (err) {
      console.error('Error fetching submissions:', err);
      showToast('আবেদনসমূহ আনতে ব্যর্থ হয়েছে', 'error');
    }
  }

  function renderSubmissionsTable(submissions, fields) {
    const tableBody = document.getElementById('submissions-table-body');
    const emptyState = document.getElementById('submissions-empty-state');
    const tableContainer = document.getElementById('submissions-table-wrap');

    tableBody.innerHTML = '';

    if (!submissions || submissions.length === 0) {
      tableContainer.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    tableContainer.style.display = 'block';
    emptyState.style.display = 'none';

    submissions.forEach((item, index) => {
      const tr = document.createElement('tr');

      // Format Date
      const dateFormatted = new Date(item.created_at).toLocaleString('bn-BD', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });

      tr.innerHTML = `
        <td style="font-weight: 600; color: var(--text-muted); width: 60px;">#${index + 1}</td>
        <td><span class="code-badge">${escapeHtml(item.submission_code)}</span></td>
        <td>
          <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(item.summary_name || 'নামহীন আবেদন')}</div>
        </td>
        <td style="color: var(--text-muted); font-size: 0.875rem;">${dateFormatted}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button type="button" class="btn btn-outline btn-sm btn-view-details" data-id="${item.id}" style="margin-right: 6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span>বিস্তারিত</span>
          </button>
          <button type="button" class="btn btn-danger btn-sm btn-delete-sub" data-id="${item.id}" title="মুছে ফেলুন">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    // Bind Detail & Delete Events
    tableBody.querySelectorAll('.btn-view-details').forEach(btn => {
      btn.addEventListener('click', () => openDetailsModal(btn.dataset.id));
    });

    tableBody.querySelectorAll('.btn-delete-sub').forEach(btn => {
      btn.addEventListener('click', () => deleteSubmission(btn.dataset.id));
    });
  }

  // Search Input Handler
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
      loadSubmissions();
    }, 300);
  });

  // Refresh Table Button
  document.getElementById('btn-refresh-submissions').addEventListener('click', () => {
    loadSubmissions();
    showToast('তালিকা রিফ্রেশ করা হয়েছে', 'success');
  });

  // CSV Export Button
  document.getElementById('btn-export-csv').addEventListener('click', () => {
    window.location.href = '/api/export/csv';
  });

  // Open Details Modal
  async function openDetailsModal(id) {
    try {
      const res = await fetch(`/api/submissions/${id}`);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'তথ্য লোড করা যায়নি');
      }

      const item = data.submission;
      const fields = data.fields;

      document.getElementById('detail-modal-code').textContent = item.submission_code;
      document.getElementById('detail-modal-date').textContent = new Date(item.created_at).toLocaleString('bn-BD', {
        dateStyle: 'full',
        timeStyle: 'medium'
      });

      const container = document.getElementById('detail-fields-list');
      container.innerHTML = '';

      fields.forEach(field => {
        const val = item.data[field.id];
        const valDisplay = (val === undefined || val === null || val === '') ? '—' : val;

        const box = document.createElement('div');
        box.className = 'detail-item-box';
        box.innerHTML = `
          <div class="detail-label">${escapeHtml(field.label)}</div>
          <div class="detail-val">${escapeHtml(valDisplay)}</div>
        `;
        container.appendChild(box);
      });

      detailsModalBackdrop.classList.add('is-active');
    } catch (err) {
      console.error('Error opening details:', err);
      showToast('আবেদনের বিস্তারিত লোড করতে ব্যর্থ হয়েছে', 'error');
    }
  }

  // Close Details Modal
  document.getElementById('btn-close-details-modal').addEventListener('click', () => {
    detailsModalBackdrop.classList.remove('is-active');
  });
  document.getElementById('btn-close-details-footer').addEventListener('click', () => {
    detailsModalBackdrop.classList.remove('is-active');
  });
  detailsModalBackdrop.addEventListener('click', (e) => {
    if (e.target === detailsModalBackdrop) {
      detailsModalBackdrop.classList.remove('is-active');
    }
  });

  // Delete Submission
  async function deleteSubmission(id) {
    if (!confirm('আপনি কি নিশ্চিত যে এই আবেদনটি স্থায়ীভাবে মুছে ফেলতে চান?')) {
      return;
    }

    try {
      const res = await fetch(`/api/submissions/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      showToast('আবেদনটি মুছে ফেলা হয়েছে', 'success');
      loadSubmissions();
    } catch (err) {
      console.error('Delete error:', err);
      showToast('মুছতে ব্যর্থ হয়েছে', 'error');
    }
  }

  // =========================================================================
  // FORM BUILDER & CONFIGURATION
  // =========================================================================

  async function loadFormConfig() {
    try {
      const res = await fetch('/api/form-config');
      const data = await res.json();

      if (!data.success) throw new Error(data.message);

      formSettings = data.settings;
      formFields = data.fields;

      // Populate Settings Inputs
      document.getElementById('builder-form-title').value = formSettings.title || '';
      document.getElementById('builder-form-desc').value = formSettings.description || '';
      document.getElementById('builder-form-active').checked = Boolean(formSettings.is_active);

      renderBuilderFieldsList();
    } catch (err) {
      console.error('Error loading builder config:', err);
      showToast('ফর্মের তথ্য লোড করতে সমস্যা হয়েছে', 'error');
    }
  }

  function getFieldTypeLabel(type) {
    const map = {
      text: 'টেক্সট (Text)',
      email: 'ইমেইল (Email)',
      tel: 'ফোন নম্বর (Phone)',
      select: 'ড্রপডাউন (Dropdown)',
      radio: 'রেডিও (Radio)',
      textarea: 'বিবরণ (Textarea)',
      number: 'সংখ্যা (Number)',
      date: 'তারিখ (Date)'
    };
    return map[type] || type;
  }

  function renderBuilderFieldsList() {
    const container = document.getElementById('builder-fields-container');
    container.innerHTML = '';

    if (formFields.length === 0) {
      container.innerHTML = `
        <div class="empty-placeholder">
          <p>কোনো ফিল্ড যোগ করা হয়নি। নিচের "নতুন ফিল্ড যোগ করুন" বাটনে ক্লিক করুন।</p>
        </div>
      `;
      return;
    }

    formFields.forEach((field, index) => {
      const item = document.createElement('div');
      item.className = 'builder-field-item';

      item.innerHTML = `
        <div class="field-item-left">
          <div class="drag-handle" title="ক্রমিক #${index + 1}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="12" r="1"></circle>
              <circle cx="9" cy="5" r="1"></circle>
              <circle cx="9" cy="19" r="1"></circle>
              <circle cx="15" cy="12" r="1"></circle>
              <circle cx="15" cy="5" r="1"></circle>
              <circle cx="15" cy="19" r="1"></circle>
            </svg>
          </div>
          <div class="field-item-info">
            <div class="field-item-title">${escapeHtml(field.label)}</div>
            <div class="field-item-meta">
              <span class="type-badge">${getFieldTypeLabel(field.type)}</span>
              ${field.required ? '<span class="badge badge-danger" style="font-size: 0.725rem; padding: 1px 6px;">আবশ্যক</span>' : '<span style="font-size: 0.75rem; color: var(--text-muted);">ঐচ্ছিক</span>'}
              ${(field.type === 'select' || field.type === 'radio') && field.options?.length ? `<span style="font-size: 0.75rem; color: var(--green-700);">${field.options.length} টি অপশন</span>` : ''}
            </div>
          </div>
        </div>

        <div class="field-item-actions">
          <button type="button" class="btn btn-secondary btn-icon btn-sm btn-move-up" data-index="${index}" title="উপরে নিন" ${index === 0 ? 'disabled style="opacity: 0.3;"' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
          </button>
          <button type="button" class="btn btn-secondary btn-icon btn-sm btn-move-down" data-index="${index}" title="নিচে নিন" ${index === formFields.length - 1 ? 'disabled style="opacity: 0.3;"' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <button type="button" class="btn btn-outline btn-sm btn-edit-field" data-index="${index}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            <span>সম্পাদনা</span>
          </button>
          <button type="button" class="btn btn-danger btn-icon btn-sm btn-delete-field" data-index="${index}" title="মুছে ফেলুন">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;

      container.appendChild(item);
    });

    // Reordering events
    container.querySelectorAll('.btn-move-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (idx > 0) {
          const temp = formFields[idx];
          formFields[idx] = formFields[idx - 1];
          formFields[idx - 1] = temp;
          renderBuilderFieldsList();
        }
      });
    });

    container.querySelectorAll('.btn-move-down').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (idx < formFields.length - 1) {
          const temp = formFields[idx];
          formFields[idx] = formFields[idx + 1];
          formFields[idx + 1] = temp;
          renderBuilderFieldsList();
        }
      });
    });

    // Edit and Delete
    container.querySelectorAll('.btn-edit-field').forEach(btn => {
      btn.addEventListener('click', () => openFieldModal(parseInt(btn.dataset.index, 10)));
    });

    container.querySelectorAll('.btn-delete-field').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (confirm(`আপনি কি "${formFields[idx].label}" ফিল্ডটি মুছে ফেলতে চান?`)) {
          formFields.splice(idx, 1);
          renderBuilderFieldsList();
          showToast('ফিল্ড মুছে ফেলা হয়েছে', 'success');
        }
      });
    });
  }

  // Initialize Field Type Custom Select Component inside Modal
  function initFieldTypeDropdown() {
    const selectBox = document.getElementById('field-type-select-box');
    if (!selectBox) return;

    const typeOptions = [
      { label: 'সাধারণ টেক্সট (Text)', value: 'text' },
      { label: 'ইমেইল (Email)', value: 'email' },
      { label: 'মোবাইল / ফোন নম্বর (Phone)', value: 'tel' },
      { label: 'কাস্টম ড্রপডাউন মেনু (Dropdown)', value: 'select' },
      { label: 'রেডিও বাটন (Radio Option)', value: 'radio' },
      { label: 'বড় টেক্সট / বিবরণ (Textarea)', value: 'textarea' },
      { label: 'সংখ্যা (Number)', value: 'number' },
      { label: 'তারিখ (Date)', value: 'date' }
    ];

    fieldTypeSelectInstance = new CustomSelect(selectBox, {
      name: 'modal_field_type',
      placeholder: 'ফিল্ডের ধরন নির্বাচন করুন...',
      required: true,
      options: typeOptions,
      value: 'text',
      onChange: (val) => {
        toggleOptionsInputVisibility(val);
      }
    });
  }

  function toggleOptionsInputVisibility(type) {
    const optionsGroup = document.getElementById('field-options-group');
    if (type === 'select' || type === 'radio') {
      optionsGroup.style.display = 'block';
    } else {
      optionsGroup.style.display = 'none';
    }
  }

  // Open Add/Edit Field Modal
  function openFieldModal(index = -1) {
    currentEditingFieldIndex = index;
    const modalTitle = document.getElementById('field-modal-title');
    const labelInput = document.getElementById('field-modal-label');
    const placeholderInput = document.getElementById('field-modal-placeholder');
    const optionsInput = document.getElementById('field-modal-options');
    const requiredCheckbox = document.getElementById('field-modal-required');

    if (index >= 0) {
      // Edit mode
      const field = formFields[index];
      modalTitle.textContent = 'ফিল্ড সম্পাদনা করুন';
      labelInput.value = field.label || '';
      placeholderInput.value = field.placeholder || '';
      optionsInput.value = (field.options || []).join(', ');
      requiredCheckbox.checked = Boolean(field.required);
      fieldTypeSelectInstance.setValue(field.type || 'text');
      toggleOptionsInputVisibility(field.type || 'text');
    } else {
      // Add mode
      modalTitle.textContent = 'নতুন ফিল্ড যোগ করুন';
      labelInput.value = '';
      placeholderInput.value = '';
      optionsInput.value = '';
      requiredCheckbox.checked = false;
      fieldTypeSelectInstance.setValue('text');
      toggleOptionsInputVisibility('text');
    }

    fieldModalBackdrop.classList.add('is-active');
    setTimeout(() => labelInput.focus(), 50);
  }

  // Close Field Modal
  function closeFieldModal() {
    fieldModalBackdrop.classList.remove('is-active');
    currentEditingFieldIndex = -1;
  }

  document.getElementById('btn-add-new-field').addEventListener('click', () => openFieldModal(-1));
  document.getElementById('btn-close-field-modal').addEventListener('click', closeFieldModal);
  document.getElementById('btn-cancel-field-modal').addEventListener('click', closeFieldModal);
  fieldModalBackdrop.addEventListener('click', (e) => {
    if (e.target === fieldModalBackdrop) closeFieldModal();
  });

  // Save Field from Modal
  document.getElementById('field-modal-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const label = document.getElementById('field-modal-label').value.trim();
    const type = fieldTypeSelectInstance.getValue() || 'text';
    const placeholder = document.getElementById('field-modal-placeholder').value.trim();
    const optionsRaw = document.getElementById('field-modal-options').value.trim();
    const required = document.getElementById('field-modal-required').checked;

    if (!label) {
      showToast('অনুগ্রহ করে ফিল্ডের শিরোনাম লিখুন', 'error');
      return;
    }

    // Parse options if select or radio
    let options = [];
    if (type === 'select' || type === 'radio') {
      if (optionsRaw) {
        options = optionsRaw.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (options.length === 0) {
        showToast('ড্রপডাউন বা রেডিও ফিল্ডের জন্য অন্তত একটি অপশন প্রদান করুন (কমা দিয়ে লিখুন)', 'error');
        return;
      }
    }

    if (currentEditingFieldIndex >= 0) {
      // Update existing
      formFields[currentEditingFieldIndex] = {
        ...formFields[currentEditingFieldIndex],
        label,
        type,
        placeholder,
        options,
        required
      };
      showToast('ফিল্ড আপডেট করা হয়েছে', 'success');
    } else {
      // Add new
      const newId = `field_${Date.now()}`;
      formFields.push({
        id: newId,
        label,
        type,
        placeholder,
        options,
        required
      });
      showToast('নতুন ফিল্ড যোগ করা হয়েছে', 'success');
    }

    closeFieldModal();
    renderBuilderFieldsList();
  });

  // Save All Configuration to Server
  document.getElementById('btn-save-form-config').addEventListener('click', async () => {
    const title = document.getElementById('builder-form-title').value.trim();
    const description = document.getElementById('builder-form-desc').value.trim();
    const isActive = document.getElementById('builder-form-active').checked;

    if (!title) {
      showToast('ফর্মের শিরোনাম আবশ্যক', 'error');
      return;
    }

    const saveBtn = document.getElementById('btn-save-form-config');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `
      <div style="width: 16px; height: 16px; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite;"></div>
      <span>সংরক্ষণ হচ্ছে...</span>
    `;

    try {
      const res = await fetch('/api/form-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          is_active: isActive,
          fields: formFields
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      showToast('ফর্ম সেটিংস ও ফিল্ডসমূহ সফলভাবে সংরক্ষণ ও অ্যাক্টিভ করা হয়েছে!', 'success');
    } catch (err) {
      console.error('Error saving form config:', err);
      showToast(err.message || 'সংরক্ষণ ব্যর্থ হয়েছে', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
    }
  });

  // Init
  initFieldTypeDropdown();
  loadSubmissions();
});
