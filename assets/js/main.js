const bookingForm = document.querySelector('#booking-form');
const serviceDateInput = document.querySelector('#service-date');
const serviceTimeSelect = document.querySelector('#service-time');
const currentYearElement = document.querySelector('#year');
const navToggle = document.querySelector('[data-nav-toggle]');
const primaryNav = document.querySelector('#primary-nav');

const timeSlots = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00'
];

function populateTimeSlots() {
  const fragment = document.createDocumentFragment();
  timeSlots.forEach((time) => {
    const option = document.createElement('option');
    option.value = time;
    option.textContent = `${time}h`;
    fragment.appendChild(option);
  });
  serviceTimeSelect.appendChild(fragment);
}

function setMinDate() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - offset * 60 * 1000)
    .toISOString()
    .split('T')[0];
  serviceDateInput.min = localDate;
  serviceDateInput.value = localDate;
}

function handleSubmit(event) {
  event.preventDefault();

  if (!bookingForm.reportValidity()) {
    return;
  }

  const service = bookingForm.service.value.trim();
  const date = bookingForm.date.value;
  const selectedTimes = Array.from(serviceTimeSelect.selectedOptions).map(
    (option) => option.value
  );

  if (selectedTimes.length === 0) {
    serviceTimeSelect.setCustomValidity('Selecione pelo menos um horário disponível.');
    serviceTimeSelect.reportValidity();
    return;
  }

  serviceTimeSelect.setCustomValidity('');

  const params = new URLSearchParams({
    service,
    date,
    times: selectedTimes.join(',')
  });

  window.location.href = `schedule.html?${params.toString()}`;
}

function closeNavigation() {
  if (!navToggle || !primaryNav) {
    return;
  }

  navToggle.setAttribute('aria-expanded', 'false');
  navToggle.classList.remove('nav-toggle--open');
  primaryNav.classList.remove('nav--open');
  document.body.classList.remove('menu-open');
}

function openNavigation() {
  if (!navToggle || !primaryNav) {
    return;
  }

  navToggle.setAttribute('aria-expanded', 'true');
  navToggle.classList.add('nav-toggle--open');
  primaryNav.classList.add('nav--open');
  document.body.classList.add('menu-open');
}

function initNavigation() {
  if (!navToggle || !primaryNav) {
    return;
  }

  closeNavigation();

  navToggle.addEventListener('click', () => {
    const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
      closeNavigation();
    } else {
      openNavigation();
    }
  });

  primaryNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      closeNavigation();
    });
  });

  document.addEventListener('click', (event) => {
    if (!primaryNav.classList.contains('nav--open')) {
      return;
    }

    if (event.target === navToggle || navToggle.contains(event.target)) {
      return;
    }

    if (primaryNav.contains(event.target)) {
      return;
    }

    closeNavigation();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeNavigation();
    }
  });

  const mediaQuery = window.matchMedia('(min-width: 721px)');
  const handleMediaChange = (event) => {
    if (event.matches) {
      closeNavigation();
    }
  };

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleMediaChange);
  } else if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(handleMediaChange);
  }
}

function init() {
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear();
  }

  initNavigation();

  if (serviceTimeSelect) {
    populateTimeSlots();
  }

  if (serviceDateInput) {
    setMinDate();
  }

  if (bookingForm) {
    bookingForm.addEventListener('submit', handleSubmit);
  }
}

init();
