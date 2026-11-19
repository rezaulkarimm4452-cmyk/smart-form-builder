/**
 * Custom Accessible Dropdown Component (Green & White Theme)
 * Completely eliminates the default browser/OS dropdown menu.
 */
class CustomSelect {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.container) return;

    this.options = options.options || []; // [{ label, value }]
    this.name = options.name || this.container.dataset.name || 'select_field';
    this.placeholder = options.placeholder || this.container.dataset.placeholder || 'একটি বিকল্প নির্বাচন করুন...';
    this.required = options.required ?? (this.container.dataset.required === 'true');
    this.value = options.value || this.container.dataset.value || '';
    this.onChange = options.onChange || null;

    this.isOpen = false;
    this.activeIndex = -1;

    this.init();
  }

  init() {
    this.container.classList.add('custom-select-wrapper');
    this.container.innerHTML = '';

    // Hidden input for form values and native validation
    this.hiddenInput = document.createElement('input');
    this.hiddenInput.type = 'hidden';
    this.hiddenInput.name = this.name;
    this.hiddenInput.value = this.value;
    if (this.required) {
      this.hiddenInput.setAttribute('required', 'true');
    }
    this.container.appendChild(this.hiddenInput);

    // Trigger Button
    this.trigger = document.createElement('button');
    this.trigger.type = 'button';
    this.trigger.className = 'custom-select-trigger';
    this.trigger.setAttribute('aria-haspopup', 'listbox');
    this.trigger.setAttribute('aria-expanded', 'false');

    this.labelSpan = document.createElement('span');
    this.labelSpan.className = 'custom-select-value';
    this.updateTriggerText();

    // Custom SVG arrow icon
    this.arrowIcon = document.createElement('span');
    this.arrowIcon.className = 'custom-select-arrow';
    this.arrowIcon.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;

    this.trigger.appendChild(this.labelSpan);
    this.trigger.appendChild(this.arrowIcon);
    this.container.appendChild(this.trigger);

    // Dropdown Listbox
    this.menu = document.createElement('div');
    this.menu.className = 'custom-select-menu';
    this.menu.setAttribute('role', 'listbox');

    // If options length > 6, add quick search filter
    if (this.options.length > 6) {
      const searchBox = document.createElement('div');
      searchBox.className = 'custom-select-search';
      searchBox.innerHTML = `
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" placeholder="খুঁজুন..." class="custom-select-search-input" />
      `;
      this.searchInput = searchBox.querySelector('input');
      this.searchInput.addEventListener('input', (e) => this.filterOptions(e.target.value));
      this.searchInput.addEventListener('click', (e) => e.stopPropagation());
      this.menu.appendChild(searchBox);
    }

    this.listContainer = document.createElement('div');
    this.listContainer.className = 'custom-select-list';
    this.menu.appendChild(this.listContainer);

    this.renderOptions(this.options);
    this.container.appendChild(this.menu);

    this.bindEvents();
  }

  updateTriggerText() {
    const selectedOption = this.options.find(opt => opt.value === this.value);
    if (selectedOption) {
      this.labelSpan.textContent = selectedOption.label;
      this.labelSpan.classList.remove('is-placeholder');
    } else {
      this.labelSpan.textContent = this.placeholder;
      this.labelSpan.classList.add('is-placeholder');
    }
  }

  renderOptions(filteredOptions) {
    this.listContainer.innerHTML = '';
    if (filteredOptions.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'custom-select-empty';
      noResults.textContent = 'কোনো ফলাফল পাওয়া যায়নি';
      this.listContainer.appendChild(noResults);
      return;
    }

    filteredOptions.forEach((opt, idx) => {
      const item = document.createElement('div');
      item.className = 'custom-select-option';
      item.setAttribute('role', 'option');
      item.dataset.value = opt.value;
      item.dataset.index = idx;

      const isSelected = opt.value === this.value;
      if (isSelected) {
        item.classList.add('is-selected');
        item.setAttribute('aria-selected', 'true');
      }

      // Option label + Checkmark
      item.innerHTML = `
        <span class="option-text">${this.escapeHtml(opt.label)}</span>
        <span class="option-check ${isSelected ? 'active' : ''}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </span>
      `;

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectValue(opt.value);
        this.close();
      });

      this.listContainer.appendChild(item);
    });
  }

  filterOptions(query) {
    const q = query.trim().toLowerCase();
    const filtered = this.options.filter(opt => 
      opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q)
    );
    this.renderOptions(filtered);
  }

  bindEvents() {
    // Toggle on trigger click
    this.trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.container.contains(e.target)) {
        this.close();
      }
    });

    // Window resize adjustment
    window.addEventListener('resize', () => {
      if (this.isOpen) {
        this.adjustPlacement();
      }
    });

    // Keyboard navigation
    this.container.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
        this.trigger.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!this.isOpen) {
          this.open();
        } else {
          this.navigateOptions(1);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.isOpen) {
          this.navigateOptions(-1);
        }
      } else if (e.key === 'Enter') {
        if (this.isOpen && this.activeIndex >= 0) {
          e.preventDefault();
          const items = this.listContainer.querySelectorAll('.custom-select-option');
          if (items[this.activeIndex]) {
            items[this.activeIndex].click();
          }
        }
      }
    });
  }

  navigateOptions(direction) {
    const items = this.listContainer.querySelectorAll('.custom-select-option');
    if (items.length === 0) return;

    items.forEach(i => i.classList.remove('is-active-focus'));
    this.activeIndex += direction;
    if (this.activeIndex < 0) this.activeIndex = 0;
    if (this.activeIndex >= items.length) this.activeIndex = items.length - 1;

    const current = items[this.activeIndex];
    if (current) {
      current.classList.add('is-active-focus');
      current.scrollIntoView({ block: 'nearest' });
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    // Close other custom selects on the page
    document.querySelectorAll('.custom-select-wrapper.is-open').forEach(el => {
      if (el !== this.container) {
        el.classList.remove('is-open');
        el.classList.remove('opens-up');
        const trig = el.querySelector('.custom-select-trigger');
        if (trig) trig.setAttribute('aria-expanded', 'false');
      }
    });

    this.isOpen = true;
    this.container.classList.add('is-open');
    this.trigger.setAttribute('aria-expanded', 'true');

    // Viewport-aware placement and height adjustment
    this.adjustPlacement();

    // Auto-focus search input if present
    if (this.searchInput) {
      setTimeout(() => this.searchInput.focus(), 50);
    }

    // Scroll selected option into view
    const selectedItem = this.listContainer.querySelector('.is-selected');
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }

  adjustPlacement() {
    // Check available vertical space relative to viewport
    const rect = this.trigger.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const spaceBelow = windowHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Check if dropdown should flip upwards (e.g. if close to bottom of screen or modal)
    const shouldOpenUp = spaceBelow < 280 && spaceAbove > spaceBelow;

    if (shouldOpenUp) {
      this.container.classList.add('opens-up');
      const maxAvailable = Math.max(140, Math.min(260, spaceAbove - 80));
      this.listContainer.style.maxHeight = `${maxAvailable}px`;
    } else {
      this.container.classList.remove('opens-up');
      const maxAvailable = Math.max(140, Math.min(260, spaceBelow - 80));
      this.listContainer.style.maxHeight = `${maxAvailable}px`;
    }

    // Elevate parent form group z-index so nothing paints on top
    const parentFormGroup = this.container.closest('.form-group');
    if (parentFormGroup) {
      parentFormGroup.style.zIndex = '1000';
      parentFormGroup.style.position = 'relative';
    }
  }

  close() {
    this.isOpen = false;
    this.container.classList.remove('is-open');
    this.container.classList.remove('opens-up');
    this.trigger.setAttribute('aria-expanded', 'false');
    this.activeIndex = -1;

    const parentFormGroup = this.container.closest('.form-group');
    if (parentFormGroup) {
      parentFormGroup.style.zIndex = '';
    }

    if (this.searchInput) {
      this.searchInput.value = '';
      this.renderOptions(this.options);
    }
  }

  selectValue(val) {
    this.value = val;
    this.hiddenInput.value = val;
    this.updateTriggerText();
    this.renderOptions(this.options);

    // Trigger change event
    const event = new Event('change', { bubbles: true });
    this.hiddenInput.dispatchEvent(event);

    if (typeof this.onChange === 'function') {
      this.onChange(val);
    }
  }

  setOptions(newOptions, resetValue = true) {
    this.options = newOptions;
    if (resetValue) {
      this.value = '';
      this.hiddenInput.value = '';
    }
    this.updateTriggerText();
    this.renderOptions(this.options);
  }

  setValue(val) {
    this.selectValue(val);
  }

  getValue() {
    return this.value;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Global expose
window.CustomSelect = CustomSelect;
