async function loadReport() {
  const response = await fetch('./data/report.json');
  if (!response.ok) {
    throw new Error(`Failed to load report data: ${response.status}`);
  }

  return response.json();
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
}

function renderMeta(report) {
  const meta = document.getElementById('report-meta');
  meta.innerHTML = `
    <div class="meta-card">
      <span class="meta-label">Window</span>
      <strong>${formatDate(report.reportWindow.startDate)} to ${formatDate(report.reportWindow.endDate)}</strong>
    </div>
    <div class="meta-card">
      <span class="meta-label">Generated</span>
      <strong>${formatDate(report.generatedAt)}</strong>
    </div>
  `;
}

function renderMethodology(report) {
  const list = document.getElementById('methodology-list');
  list.innerHTML = '';
  for (const item of report.methodology) {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  }
}

function renderBars(container, series) {
  const max = Math.max(...series.map((point) => point.count), 1);
  container.innerHTML = '';

  for (const point of series) {
    const item = document.createElement('div');
    item.className = 'bar-item';
    item.innerHTML = `
      <div class="bar-wrap">
        <div class="bar-fill" style="height:${(point.count / max) * 100}%"></div>
      </div>
      <span class="bar-value">${point.count}</span>
      <span class="bar-label">${point.label}</span>
    `;
    container.appendChild(item);
  }
}

function renderThemeList(container, themes) {
  container.innerHTML = '';
  for (const theme of themes) {
    const card = document.createElement('div');
    card.className = 'theme-card';
    const example = theme.examples[0];
    card.innerHTML = `
      <div class="theme-topline">
        <strong>${theme.label}</strong>
        <span>${theme.count}</span>
      </div>
      ${example ? `<p>${example.summary}</p>` : '<p>No example captured.</p>'}
    `;
    container.appendChild(card);
  }
}

function renderDepartmentList(container, departments) {
  container.innerHTML = '';
  for (const dept of departments) {
    const row = document.createElement('div');
    row.className = 'department-row';
    row.innerHTML = `
      <span>${dept.label}</span>
      <strong>${dept.count}</strong>
    `;
    container.appendChild(row);
  }
}

function renderRecommendations(container, recommendations) {
  container.innerHTML = '';
  for (const recommendation of recommendations) {
    const li = document.createElement('li');
    li.textContent = recommendation;
    container.appendChild(li);
  }
}

function renderExamples(container, examples) {
  container.innerHTML = '';
  for (const example of examples) {
    const card = document.createElement('a');
    card.className = 'example-card';
    card.href = example.webUrl;
    card.target = '_blank';
    card.rel = 'noreferrer';
    card.innerHTML = `
      <div class="example-header">
        <strong>${example.key}</strong>
        <span>${formatDate(example.resolutionDate)}</span>
      </div>
      <p>${example.summary}</p>
      <div class="example-meta">
        <span>${example.department}</span>
        <span>${example.requestType}</span>
      </div>
    `;
    container.appendChild(card);
  }
}

function renderApp(app, index) {
  const template = document.getElementById('app-template');
  const fragment = template.content.cloneNode(true);

  fragment.querySelector('.app-kicker').textContent = `App ${index + 1}`;
  fragment.querySelector('.app-title').textContent = app.label;
  fragment.querySelector('.stat-value').textContent = app.totalTickets;

  renderBars(fragment.querySelector('.chart-bars'), app.monthlySeries);
  renderThemeList(fragment.querySelector('.theme-list'), app.themes.slice(0, 4));
  renderDepartmentList(fragment.querySelector('.department-list'), app.departmentBreakdown);
  renderRecommendations(fragment.querySelector('.recommendation-list'), app.recommendations);
  renderExamples(fragment.querySelector('.example-list'), app.recentExamples);

  return fragment;
}

async function main() {
  try {
    const report = await loadReport();
    renderMeta(report);
    renderMethodology(report);

    const grid = document.getElementById('app-grid');
    grid.innerHTML = '';
    report.apps.forEach((app, index) => {
      grid.appendChild(renderApp(app, index));
    });
  } catch (error) {
    document.getElementById('app-grid').innerHTML = `<p class="error-state">${error.message}</p>`;
  }
}

main();
