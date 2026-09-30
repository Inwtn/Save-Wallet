const categories = {
  expense: [['Casa', '🏠'], ['Alimentação', '🍽️'], ['Transporte', '🚗'], ['Saúde', '💊'], ['Lazer', '🎟️'], ['Compras', '🛍️'], ['Contas', '💡'], ['Outros', '📦']],
  income: [['Salário', '💼'], ['Freelance', '✨'], ['Investimentos', '📈'], ['Outros', '💰']]
};

const $ = id => document.getElementById(id);
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
let supabaseClient;
let currentUser;
let transactions = [];
let budget = 0;
let selectedMonth = new Date().toLocaleDateString('sv-SE').slice(0, 7);
let authMode = 'signin';
let loadedUserId = null;

const themeKey = 'meu-financeiro-theme';
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('themeToggle').textContent = theme === 'dark' ? '☀' : '☾';
  $('themeToggle').setAttribute('aria-label', theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro');
  document.querySelector('meta[name=theme-color]').content = theme === 'dark' ? '#111814' : '#f7f8f5';
}
applyTheme(localStorage.getItem(themeKey) || 'light');
$('themeToggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(themeKey, next);
  applyTheme(next);
});
document.querySelector('#categories').parentElement.querySelector('.panel-title').textContent = 'Receitas e despesas por categoria';

function esc(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function showMessage(target, message, isError = false) {
  const node = $(target);
  node.textContent = message;
  node.dataset.error = isError ? 'true' : 'false';
  node.hidden = !message;
}

function setAuthenticated(user) {
  currentUser = user || null;
  $('authScreen').hidden = Boolean(currentUser);
  $('appShell').hidden = !currentUser;
  if (currentUser) {
    $('userEmail').textContent = currentUser.email || 'Conta';
    showMessage('authMessage', '');
  } else {
    loadedUserId = null;
    transactions = [];
    budget = 0;
  }
}

function monthTransactions() {
  return transactions.filter(transaction => transaction.date.startsWith(selectedMonth));
}

function render() {
  const month = monthTransactions();
  const income = month.filter(item => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0);
  const expense = month.filter(item => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount), 0);
  $('balance').textContent = money(income - expense);
  $('balance').className = `card-value ${income - expense < 0 ? 'negative' : ''}`;
  $('balanceFoot').textContent = income - expense < 0 ? 'As despesas passaram das receitas' : 'Receitas menos despesas';
  $('income').textContent = money(income);
  $('expense').textContent = money(expense);
  $('budgetInput').value = budget || '';
  $('budgetNumbers').textContent = `${money(expense)} / ${money(budget)}`;
  $('budgetBar').style.width = budget ? `${Math.min(100, expense / budget * 100)}%` : '0%';
  $('budgetBar').style.background = budget && expense > budget ? '#cf5b55' : '#37a477';
  $('budgetNote').textContent = budget ? (expense > budget ? `Você passou ${money(expense - budget)} do limite.` : `Restam ${money(Math.max(0, budget - expense))} do seu limite.`) : 'Defina um limite para acompanhar seu orçamento.';
  renderCategories(month);
  renderChart(month);
  renderRows(month);
}

function renderCategories(month) {
  const section = type => {
    const totals = {};
    month.filter(item => item.type === type).forEach(item => { totals[item.category] = (totals[item.category] || 0) + Number(item.amount); });
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const max = entries[0]?.[1] || 1;
    return entries.length ? entries.map(([name, amount]) => {
      const icon = categories[type].find(item => item[0] === name)?.[1] || '📦';
      return `<div class="category"><div class="category-icon">${icon}</div><div><div class="category-name">${esc(name)}</div><div class="category-track"><span style="width:${amount / max * 100}%"></span></div></div><div class="category-amount">${money(amount)}</div></div>`;
    }).join('') : '<div class="empty">Sem lançamentos</div>';
  };
  $('categories').innerHTML = `<div class="category-section-title">Despesas</div>${section('expense')}<div class="category-section-title">Receitas</div>${section('income')}`;
}

function renderChart(month) {
  const income = [0, 0, 0, 0];
  const expense = [0, 0, 0, 0];
  month.forEach(item => {
    const week = Math.min(3, Math.floor((Number(item.date.slice(8, 10)) - 1) / 7));
    (item.type === 'income' ? income : expense)[week] += Number(item.amount);
  });
  const max = Math.max(...income, ...expense, 1000);
  const path = values => values.map((value, index) => `${index ? 'L' : 'M'} ${index * 200} ${120 - value / max * 105}`).join(' ');
  $('incomePath').setAttribute('d', path(income));
  $('expensePath').setAttribute('d', path(expense));
}

function renderRows(month) {
  const query = $('search').value.toLocaleLowerCase('pt-BR');
  const type = $('typeFilter').value;
  const rows = month.filter(item => (type === 'all' || item.type === type) && `${item.description} ${item.category}`.toLocaleLowerCase('pt-BR').includes(query)).sort((a, b) => b.date.localeCompare(a.date));
  $('transactionRows').innerHTML = rows.length ? rows.map(item => {
    const icon = categories[item.type].find(category => category[0] === item.category)?.[1] || '📦';
    const kind = item.type === 'income';
    return `<tr><td><div class="desc"><span class="tx-icon">${icon}</span>${esc(item.description)}</div></td><td><span class="tag">${esc(item.category)}</span></td><td>${new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR')}</td><td><span class="type ${kind ? 'in' : 'out'}">${kind ? 'Receita' : 'Despesa'}</span></td><td class="${kind ? 'positive' : 'negative'}">${kind ? '+' : '−'} ${money(item.amount)}</td><td><button class="delete" data-id="${esc(item.id)}" aria-label="Excluir ${esc(item.description)}" title="Excluir">×</button></td></tr>`;
  }).join('') : '<tr><td class="empty" colspan="6">Nenhuma transação neste mês. Clique em “Nova transação” para começar.</td></tr>';
}

function setCategories(type) {
  $('txCategory').innerHTML = categories[type].map(([name]) => `<option>${name}</option>`).join('');
}

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  setTimeout(() => $('toast').classList.remove('show'), 2200);
}

async function loadAccountData(user) {
  const [transactionResult, settingResult] = await Promise.all([
    supabaseClient.from('finance_transactions').select('id,user_id,type,description,amount,category,date').eq('user_id', user.id).order('date', { ascending: false }),
    supabaseClient.from('finance_settings').select('monthly_budget').eq('user_id', user.id).maybeSingle()
  ]);
  if (transactionResult.error) throw transactionResult.error;
  if (settingResult.error) throw settingResult.error;
  transactions = (transactionResult.data || []).map(item => ({ ...item, amount: Number(item.amount) }));
  budget = Number(settingResult.data?.monthly_budget) || 0;
  render();
}

function authError(error) {
  const known = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'User already registered': 'Já existe uma conta com este e-mail.',
    'Email not confirmed': 'Confirme seu e-mail pelo link enviado antes de entrar.'
  };
  return known[error.message] || error.message || 'Não foi possível concluir. Tente novamente.';
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === 'signup';
  const recovery = mode === 'recovery';
  $('authTitle').textContent = recovery ? 'Redefina sua senha' : signup ? 'Crie sua conta' : 'Acesse sua conta';
  $('authSubtitle').textContent = recovery ? 'Escolha uma nova senha para sua conta.' : signup ? 'Seus dados financeiros ficam privados na sua conta.' : 'Entre para acessar suas finanças com segurança.';
  $('authSubmit').textContent = recovery ? 'Salvar nova senha' : signup ? 'Criar conta' : 'Entrar';
  $('authSwitch').hidden = recovery;
  $('authSwitch').textContent = signup ? 'Já tem uma conta? Entrar' : 'Ainda não tem conta? Criar conta';
  $('authEmailField').hidden = recovery;
  $('authEmail').required = !recovery;
  $('passwordField').hidden = false;
  $('authPassword').value = '';
  $('authPassword').autocomplete = recovery || signup ? 'new-password' : 'current-password';
  $('forgotPassword').hidden = signup || recovery;
  showMessage('authMessage', '');
}

async function initialize() {
  $('monthPicker').value = selectedMonth;
  setCategories('expense');
  setAuthMode('signin');

  let config;
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    config = await response.json();
    if (!response.ok) throw new Error(config.error || 'Configuração indisponível.');
  } catch (error) {
    showMessage('authMessage', `${error.message} Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no Vercel.`, true);
    return;
  }

  if (!window.supabase?.createClient) {
    showMessage('authMessage', 'Não foi possível carregar o cliente do banco. Recarregue a página e tente novamente.', true);
    return;
  }

  supabaseClient = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
  });

  $('authSwitch').addEventListener('click', () => setAuthMode(authMode === 'signin' ? 'signup' : 'signin'));
  $('authForm').addEventListener('submit', async event => {
    event.preventDefault();
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    $('authSubmit').disabled = true;
    showMessage('authMessage', authMode === 'signup' ? 'Criando sua conta…' : 'Entrando…');
    try {
      if (authMode === 'recovery') {
        const { error } = await supabaseClient.auth.updateUser({ password });
        if (error) throw error;
        showMessage('authMessage', 'Senha atualizada. Entrando na sua conta…');
      } else if (authMode === 'signup') {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          showMessage('authMessage', 'Conta criada. Confira seu e-mail e confirme o cadastro para entrar.');
        } else {
          showMessage('authMessage', 'Conta criada. Carregando seus dados…');
        }
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      showMessage('authMessage', authError(error), true);
    } finally {
      $('authSubmit').disabled = false;
    }
  });

  $('forgotPassword').addEventListener('click', async () => {
    const email = $('authEmail').value.trim();
    if (!email) {
      showMessage('authMessage', 'Digite seu e-mail para receber o link de recuperação.', true);
      $('authEmail').focus();
      return;
    }
    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/` });
      showMessage('authMessage', error ? authError(error) : 'Se este e-mail estiver cadastrado, enviaremos um link de recuperação.');
    } catch (error) {
      showMessage('authMessage', authError(error), true);
    }
  });

  $('signOut').addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) toast(authError(error));
  });

  $('monthPicker').addEventListener('change', event => { selectedMonth = event.target.value || selectedMonth; render(); });
  $('search').addEventListener('input', () => renderRows(monthTransactions()));
  $('typeFilter').addEventListener('change', () => renderRows(monthTransactions()));
  $('addButton').addEventListener('click', () => { $('txDate').value = new Date().toLocaleDateString('sv-SE'); $('transactionDialog').showModal(); });
  $('closeDialog').addEventListener('click', () => $('transactionDialog').close());
  $('transactionDialog').addEventListener('click', event => { if (event.target === $('transactionDialog')) $('transactionDialog').close(); });
  document.querySelectorAll('.type-toggle button').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.type-toggle button').forEach(item => item.classList.remove('selected'));
    button.classList.add('selected');
    $('txType').value = button.dataset.type;
    setCategories(button.dataset.type);
  }));
  $('transactionForm').addEventListener('submit', async event => {
    event.preventDefault();
    const row = { user_id: currentUser.id, type: $('txType').value, description: $('txDescription').value.trim(), amount: Number($('txAmount').value), category: $('txCategory').value, date: $('txDate').value };
    const submit = $('transactionForm').querySelector('.submit');
    submit.disabled = true;
    try {
      const { data, error } = await supabaseClient.from('finance_transactions').insert(row).select('id,user_id,type,description,amount,category,date').single();
      if (error) throw error;
      transactions.push({ ...data, amount: Number(data.amount) });
      render();
      $('transactionForm').reset();
      $('txType').value = 'expense';
      document.querySelectorAll('.type-toggle button').forEach(item => item.classList.toggle('selected', item.dataset.type === 'expense'));
      setCategories('expense');
      $('transactionDialog').close();
      toast('Transação salva');
    } catch (error) {
      toast(`Não foi possível salvar: ${authError(error)}`);
    } finally {
      submit.disabled = false;
    }
  });
  $('transactionRows').addEventListener('click', async event => {
    const button = event.target.closest('.delete');
    if (!button) return;
    const { error } = await supabaseClient.from('finance_transactions').delete().eq('id', button.dataset.id).eq('user_id', currentUser.id);
    if (error) { toast(`Não foi possível excluir: ${authError(error)}`); return; }
    transactions = transactions.filter(item => item.id !== button.dataset.id);
    render();
    toast('Transação excluída');
  });
  $('saveBudget').addEventListener('click', async () => {
    const monthlyBudget = Math.max(0, Number($('budgetInput').value) || 0);
    const button = $('saveBudget');
    button.disabled = true;
    const { error } = await supabaseClient.from('finance_settings').upsert({ user_id: currentUser.id, monthly_budget: monthlyBudget }, { onConflict: 'user_id' });
    button.disabled = false;
    if (error) { toast(`Não foi possível salvar: ${authError(error)}`); return; }
    budget = monthlyBudget;
    render();
    toast('Orçamento atualizado');
  });

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      setAuthenticated(null);
      setAuthMode('recovery');
      return;
    }
    setAuthenticated(session?.user);
    if (session?.user && loadedUserId !== session.user.id) {
      loadedUserId = session.user.id;
      loadAccountData(session.user).catch(error => showMessage('appMessage', `Não foi possível carregar seus dados: ${authError(error)}`, true));
    }
  });
}

initialize();
