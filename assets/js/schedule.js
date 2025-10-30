const summaryService = document.querySelector('#summary-service');
const summaryDate = document.querySelector('#summary-date');
const summaryTimes = document.querySelector('#summary-times');
const confirmForm = document.querySelector('#confirm-form');
const scheduleCard = document.querySelector('.schedule__card');

function formatDate(dateString) {
  if (!dateString) return '—';
  const [year, month, day] = dateString.split('-');
  const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  return formatter.format(parsedDate);
}

function formatTimes(timesString) {
  if (!timesString) return '—';
  return timesString
    .split(',')
    .filter(Boolean)
    .map((time) => `${time}h`)
    .join(', ');
}

function populateSummary() {
  const params = new URLSearchParams(window.location.search);
  const service = params.get('service');
  const date = params.get('date');
  const times = params.get('times');

  summaryService.textContent = service || 'Serviço não informado';
  summaryDate.textContent = date ? formatDate(date) : 'Data não informada';
  summaryTimes.textContent = times ? formatTimes(times) : 'Horário não informado';
}

function showConfirmationMessage(data) {
  const message = document.createElement('div');
  message.className = 'schedule__confirmation';
  message.innerHTML = `
    <h2>Pedido enviado com sucesso! 🎉</h2>
    <p>Obrigado, <strong>${data['client-name']}</strong>. Em breve entraremos em contato pelo e-mail <strong>${data['client-email']}</strong> para confirmar a disponibilidade.</p>
    <p>Enquanto isso você pode voltar para a <a href="index.html">página inicial</a> ou ajustar os detalhes do pedido.</p>
  `;
  scheduleCard.replaceChildren(message);
}

function handleConfirmSubmit(event) {
  event.preventDefault();

  if (!confirmForm.reportValidity()) {
    return;
  }

  const formData = new FormData(confirmForm);
  const data = Object.fromEntries(formData.entries());

  showConfirmationMessage(data);
}

function init() {
  populateSummary();

  if (confirmForm) {
    confirmForm.addEventListener('submit', handleConfirmSubmit);
  }
}

init();
