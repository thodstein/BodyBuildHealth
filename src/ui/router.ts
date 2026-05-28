type Route = 'dashboard' | 'dose' | 'fertility' | 'risks';
let current: Route = 'dashboard';

export function navigate(route: Route) {
  current = route;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const tab = document.querySelector(`[data-route="${route}"]`);
  if (tab) tab.classList.add('active');
  const page = document.getElementById(`page-${route}`);
  if (page) page.classList.add('active');
}

export function initRouter() {
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => navigate(t.dataset.route as Route));
  });
}