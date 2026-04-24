// ═══════════════════════════════════════════════
// app.js — Lógica Principal do Sistema
// Elite Distribuidora
// ═══════════════════════════════════════════════

import { db } from "./firebase.js";
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, addDoc, getDocs, getDoc, doc,
  updateDoc, deleteDoc, query, where, orderBy,
  Timestamp, onSnapshot, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ═══════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════
let produtos       = [];
let carrinho       = [];
let pagamento      = "dinheiro";
let editProdId     = null;
let scannerVenda   = null;
let scannerProd    = null;
let chartPag       = null;
let chartProd      = null;

// ═══════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  // Só inicializa quando autenticado
  onAuthStateChanged(auth, (user) => {
    if (user) init();
  });
});

function init() {
  setupDate();
  setupNav();
  setupVendas();
  setupProdutos();
  setupRelatorios();
  loadProdutos();
}

// ═══════════════════════════════════════════════
// DATA / HORA
// ═══════════════════════════════════════════════
function setupDate() {
  const el = document.getElementById("today-date");
  const now = new Date();
  el.textContent = now.toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric"
  });
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// ═══════════════════════════════════════════════
// NAVEGAÇÃO
// ═══════════════════════════════════════════════
function setupNav() {
  const navItems = document.querySelectorAll(".nav-item[data-page]");
  const pages    = document.querySelectorAll(".page");
  const titleEl  = document.getElementById("page-title");

  const titles = {
    dashboard: "Dashboard",
    vendas:    "Nova Venda",
    produtos:  "Produtos",
    relatorios:"Relatórios"
  };

  navItems.forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.page;

      navItems.forEach(b => b.classList.remove("active"));
      pages.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(`page-${page}`).classList.add("active");
      titleEl.textContent = titles[page] || page;

      // Fechar sidebar no mobile
      document.getElementById("sidebar").classList.remove("open");

      // Carregar dados da página
      if (page === "dashboard") loadDashboard();
      if (page === "relatorios") {
        document.getElementById("relatorio-date").value = todayStr();
        loadRelatorio(todayStr());
      }
    });
  });

  // Menu toggle mobile
  document.getElementById("menu-toggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  // Carrega dashboard ao iniciar
  loadDashboard();
}

// ═══════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════
function toast(msg, type = "default") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className   = `toast ${type}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3500);
}

// ═══════════════════════════════════════════════
// FORMATAÇÃO
// ═══════════════════════════════════════════════
function fmt(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

// ═══════════════════════════════════════════════
// PRODUTOS
// ═══════════════════════════════════════════════
async function loadProdutos() {
  try {
    const snap = await getDocs(collection(db, "produtos"));
    produtos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTabelaProdutos(produtos);
  } catch (e) {
    console.error("Erro ao carregar produtos:", e);
  }
}

function renderTabelaProdutos(lista) {
  const tbody = document.getElementById("produtos-tbody");
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Nenhum produto cadastrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(p => `
    <tr>
      <td><strong>${p.nome}</strong></td>
      <td><code style="font-size:12px;background:var(--bg2);padding:3px 8px;border-radius:4px">${p.codigoBarras || "—"}</code></td>
      <td><strong style="color:var(--gold-dk)">${fmt(p.preco)}</strong></td>
      <td>${fmt(p.custo)}</td>
      <td>
        <span class="badge ${p.estoque <= 5 ? 'low' : 'ok'}">${p.estoque} un</span>
      </td>
      <td>
        <button class="action-btn edit" onclick="editarProduto('${p.id}')">✏️ Editar</button>
        <button class="action-btn del"  onclick="deletarProduto('${p.id}', '${p.nome.replace(/'/g,"\\'")}')">🗑️</button>
      </td>
    </tr>
  `).join("");
}

function setupProdutos() {
  const modal       = document.getElementById("produto-modal");
  const btnNovo     = document.getElementById("btn-novo-produto");
  const btnClose    = document.getElementById("close-produto-modal");
  const btnCancel   = document.getElementById("btn-cancelar-produto");
  const btnSalvar   = document.getElementById("btn-salvar-produto");
  const barcodeInput= document.getElementById("prod-barcode");
  const search      = document.getElementById("produto-search");

  btnNovo.addEventListener("click", () => {
    editProdId = null;
    document.getElementById("modal-produto-title").textContent = "Novo Produto";
    clearProdForm();
    modal.classList.remove("hidden");
  });

  [btnClose, btnCancel].forEach(b => b.addEventListener("click", () => {
    modal.classList.add("hidden");
    stopScanner(scannerProd);
    scannerProd = null;
    document.getElementById("scanner-modal-prod").classList.add("hidden");
  }));

  btnSalvar.addEventListener("click", salvarProduto);

  // Preview código de barras em tempo real
  barcodeInput.addEventListener("input", () => {
    const val = barcodeInput.value.trim();
    if (val.length >= 6) renderBarcode(val, "barcode-svg");
    else document.getElementById("barcode-svg").innerHTML = "";
  });

  // Busca de produto
  search.addEventListener("input", () => {
    const term = search.value.toLowerCase();
    const filtrados = produtos.filter(p =>
      p.nome.toLowerCase().includes(term) ||
      (p.codigoBarras || "").includes(term)
    );
    renderTabelaProdutos(filtrados);
  });

  // Scanner de cadastro
  document.getElementById("btn-scan-prod").addEventListener("click", () => {
    document.getElementById("scanner-modal-prod").classList.remove("hidden");
    scannerProd = startScanner("scanner-viewport-prod", (code) => {
      barcodeInput.value = code;
      renderBarcode(code, "barcode-svg");
      document.getElementById("scanner-modal-prod").classList.add("hidden");
      stopScanner(scannerProd);
      scannerProd = null;
    });
  });

  document.getElementById("close-scanner-prod").addEventListener("click", () => {
    document.getElementById("scanner-modal-prod").classList.add("hidden");
    stopScanner(scannerProd);
    scannerProd = null;
  });
}

function clearProdForm() {
  ["prod-nome","prod-preco","prod-custo","prod-estoque","prod-barcode"].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById("barcode-svg").innerHTML = "";
}

async function salvarProduto() {
  const nome    = document.getElementById("prod-nome").value.trim();
  const preco   = parseFloat(document.getElementById("prod-preco").value);
  const custo   = parseFloat(document.getElementById("prod-custo").value);
  const estoque = parseInt(document.getElementById("prod-estoque").value);
  const barcode = document.getElementById("prod-barcode").value.trim();

  if (!nome || isNaN(preco) || isNaN(custo) || isNaN(estoque) || !barcode) {
    toast("Preencha todos os campos obrigatórios.", "error");
    return;
  }

  // Verifica duplicidade de código de barras
  const existe = produtos.find(p => p.codigoBarras === barcode && p.id !== editProdId);
  if (existe) {
    toast("Já existe um produto com esse código de barras.", "error");
    return;
  }

  const dados = { nome, preco, custo, estoque, codigoBarras: barcode };

  try {
    if (editProdId) {
      await updateDoc(doc(db, "produtos", editProdId), dados);
      toast("Produto atualizado com sucesso!", "success");
    } else {
      await addDoc(collection(db, "produtos"), dados);
      toast("Produto cadastrado com sucesso!", "success");
    }
    document.getElementById("produto-modal").classList.add("hidden");
    await loadProdutos();
  } catch (e) {
    console.error(e);
    toast("Erro ao salvar produto.", "error");
  }
}

// Expõe funções para uso inline no HTML
window.editarProduto = function(id) {
  const p = produtos.find(x => x.id === id);
  if (!p) return;
  editProdId = id;
  document.getElementById("modal-produto-title").textContent = "Editar Produto";
  document.getElementById("prod-nome").value    = p.nome;
  document.getElementById("prod-preco").value   = p.preco;
  document.getElementById("prod-custo").value   = p.custo;
  document.getElementById("prod-estoque").value = p.estoque;
  document.getElementById("prod-barcode").value = p.codigoBarras || "";
  if (p.codigoBarras) renderBarcode(p.codigoBarras, "barcode-svg");
  document.getElementById("produto-modal").classList.remove("hidden");
};

window.deletarProduto = async function(id, nome) {
  if (!confirm(`Deletar o produto "${nome}"?`)) return;
  try {
    await deleteDoc(doc(db, "produtos", id));
    await loadProdutos();
    toast("Produto removido.", "success");
  } catch (e) {
    toast("Erro ao remover produto.", "error");
  }
};

// ═══════════════════════════════════════════════
// CÓDIGO DE BARRAS
// ═══════════════════════════════════════════════
function renderBarcode(code, svgId) {
  try {
    JsBarcode(`#${svgId}`, code, {
      format: "CODE128",
      width: 2, height: 60,
      displayValue: true,
      fontSize: 12,
      margin: 10,
      lineColor: "#000",
      background: "#fff"
    });
  } catch (e) {
    console.warn("Código de barras inválido:", code);
  }
}

function startScanner(containerId, onDetected) {
  const container = document.getElementById(containerId);
  container.innerHTML = `<div class="scanner-overlay"><div class="scanner-line"></div></div>`;

  Quagga.init({
    inputStream: {
      type: "LiveStream",
      target: container,
      constraints: { facingMode: "environment" }
    },
    decoder: {
      readers: ["code_128_reader","ean_reader","ean_8_reader","upc_reader","upc_e_reader"]
    }
  }, (err) => {
    if (err) { console.error("Scanner error:", err); return; }
    Quagga.start();
  });

  Quagga.onDetected((result) => {
    const code = result.codeResult.code;
    if (code) {
      onDetected(code);
      Quagga.stop();
    }
  });

  return Quagga;
}

function stopScanner(instance) {
  try { if (instance) Quagga.stop(); } catch (e) {}
}

// ═══════════════════════════════════════════════
// VENDAS
// ═══════════════════════════════════════════════
function setupVendas() {
  const searchInput   = document.getElementById("venda-search");
  const searchResults = document.getElementById("search-results");
  const btnScan       = document.getElementById("btn-scan-venda");
  const btnFinalizar  = document.getElementById("btn-finalizar");
  const btnLimpar     = document.getElementById("btn-limpar-venda");
  const discType      = document.getElementById("discount-type");
  const discValue     = document.getElementById("discount-value");
  const payBtns       = document.querySelectorAll(".pay-btn");
  const scanModal     = document.getElementById("scanner-modal");

  // Busca de produto
  searchInput.addEventListener("input", () => {
    const term = searchInput.value.toLowerCase().trim();
    if (!term) { searchResults.classList.add("hidden"); return; }

    const found = produtos.filter(p =>
      p.nome.toLowerCase().includes(term) ||
      (p.codigoBarras || "").includes(term)
    ).slice(0, 8);

    if (!found.length) {
      searchResults.innerHTML = `<div class="search-item"><span style="color:var(--text3);font-size:13px">Nenhum produto encontrado.</span></div>`;
    } else {
      searchResults.innerHTML = found.map(p => `
        <div class="search-item" onclick="adicionarAoCarrinho('${p.id}')">
          <div>
            <div class="item-name">${p.nome}</div>
            <div class="item-stock">Estoque: ${p.estoque} un</div>
          </div>
          <div class="item-price">${fmt(p.preco)}</div>
        </div>
      `).join("");
    }

    searchResults.classList.remove("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.classList.add("hidden");
    }
  });

  // Scanner de venda
  btnScan.addEventListener("click", () => {
    scanModal.classList.remove("hidden");
    scannerVenda = startScanner("scanner-viewport", (code) => {
      const prod = produtos.find(p => p.codigoBarras === code);
      if (prod) {
        adicionarAoCarrinho(prod.id);
        toast(`✅ ${prod.nome} adicionado!`, "success");
      } else {
        toast(`Produto com código ${code} não encontrado.`, "error");
      }
      scanModal.classList.add("hidden");
      stopScanner(scannerVenda);
      scannerVenda = null;
    });
  });

  document.getElementById("close-scanner").addEventListener("click", () => {
    scanModal.classList.add("hidden");
    stopScanner(scannerVenda);
    scannerVenda = null;
  });

  // Desconto
  [discType, discValue].forEach(el => el.addEventListener("input", calcTotals));

  // Pagamento
  payBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      payBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      pagamento = btn.dataset.pay;
    });
  });

  // Finalizar
  btnFinalizar.addEventListener("click", finalizarVenda);

  // Limpar
  btnLimpar.addEventListener("click", () => {
    if (carrinho.length && !confirm("Limpar todos os itens do carrinho?")) return;
    carrinho = [];
    renderCarrinho();
    calcTotals();
  });
}

window.adicionarAoCarrinho = function(prodId) {
  const prod = produtos.find(p => p.id === prodId);
  if (!prod) return;

  if (prod.estoque <= 0) {
    toast(`${prod.nome} sem estoque!`, "error");
    return;
  }

  const existente = carrinho.find(i => i.id === prodId);
  if (existente) {
    if (existente.qty >= prod.estoque) {
      toast(`Estoque máximo: ${prod.estoque} un`, "error");
      return;
    }
    existente.qty++;
  } else {
    carrinho.push({ id: prodId, nome: prod.nome, preco: prod.preco, custo: prod.custo, qty: 1 });
  }

  document.getElementById("venda-search").value = "";
  document.getElementById("search-results").classList.add("hidden");
  renderCarrinho();
  calcTotals();
};

window.mudarQty = function(prodId, delta) {
  const item = carrinho.find(i => i.id === prodId);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  renderCarrinho();
  calcTotals();
};

window.removerItem = function(prodId) {
  carrinho = carrinho.filter(i => i.id !== prodId);
  renderCarrinho();
  calcTotals();
};

function renderCarrinho() {
  const el = document.getElementById("cart-items");
  if (!carrinho.length) {
    el.innerHTML = `
      <div class="cart-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <p>Nenhum item adicionado</p>
      </div>`;
    return;
  }

  el.innerHTML = carrinho.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="name">${item.nome}</div>
        <div class="price">${fmt(item.preco)} / un</div>
      </div>
      <div class="cart-qty">
        <button class="qty-btn" onclick="mudarQty('${item.id}', -1)">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="mudarQty('${item.id}', 1)">+</button>
      </div>
      <div class="item-total">${fmt(item.preco * item.qty)}</div>
      <button class="remove-item" onclick="removerItem('${item.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join("");
}

function calcTotals() {
  const subtotal = carrinho.reduce((s, i) => s + i.preco * i.qty, 0);
  const lucroRaw = carrinho.reduce((s, i) => s + (i.preco - i.custo) * i.qty, 0);

  const discType = document.getElementById("discount-type").value;
  const discVal  = parseFloat(document.getElementById("discount-value").value) || 0;

  let desconto = 0;
  if (discType === "fixo")    desconto = Math.min(discVal, subtotal);
  if (discType === "percent") desconto = subtotal * (Math.min(discVal, 100) / 100);

  const total = subtotal - desconto;
  const lucro = lucroRaw - desconto;

  document.getElementById("cart-subtotal").textContent = fmt(subtotal);
  document.getElementById("cart-desconto").textContent = `- ${fmt(desconto)}`;
  document.getElementById("cart-total").textContent    = fmt(total);
  document.getElementById("cart-lucro").textContent    = fmt(lucro);
  document.getElementById("cart-lucro").className = lucro >= 0 ? "green" : "red";

  return { subtotal, desconto, total, lucro };
}

async function finalizarVenda() {
  if (!carrinho.length) {
    toast("Adicione ao menos um produto.", "error");
    return;
  }

  const { subtotal, desconto, total, lucro } = calcTotals();
  const cliente = document.getElementById("cliente-nome").value.trim();
  const now = new Date();
  const dateStr = todayStr();

  const btn = document.getElementById("btn-finalizar");
  btn.disabled    = true;
  btn.textContent = "Registrando...";

  try {
    // Criar venda
    const vendaRef = await addDoc(collection(db, "vendas"), {
      data:      Timestamp.fromDate(now),
      dateStr,
      cliente:   cliente || "—",
      pagamento,
      subtotal,
      desconto,
      total,
      lucro,
      createdAt: Timestamp.fromDate(now)
    });

    // Adicionar itens como subcoleção
    const batch = writeBatch(db);
    for (const item of carrinho) {
      const itemRef = doc(collection(db, "vendas", vendaRef.id, "itens"));
      batch.set(itemRef, {
        produtoId: item.id,
        nome:      item.nome,
        preco:     item.preco,
        custo:     item.custo,
        qty:       item.qty,
        subtotal:  item.preco * item.qty,
        lucro:     (item.preco - item.custo) * item.qty
      });

      // Atualizar estoque
      const prodRef = doc(db, "produtos", item.id);
      const prodDoc = await getDoc(prodRef);
      if (prodDoc.exists()) {
        const novoEstoque = Math.max(0, prodDoc.data().estoque - item.qty);
        batch.update(prodRef, { estoque: novoEstoque });
      }
    }
    await batch.commit();

    // Fiado
    if (pagamento === "fiado" && cliente) {
      await addDoc(collection(db, "fiado"), {
        cliente,
        vendaId: vendaRef.id,
        total,
        data: Timestamp.fromDate(now),
        dateStr
      });
    }

    // Recarregar produtos (estoque atualizado)
    await loadProdutos();

    // Limpar carrinho
    carrinho = [];
    renderCarrinho();
    calcTotals();
    document.getElementById("cliente-nome").value = "";
    document.getElementById("discount-value").value = "";
    document.querySelectorAll(".pay-btn").forEach(b => b.classList.remove("active"));
    document.querySelector("[data-pay='dinheiro']").classList.add("active");
    pagamento = "dinheiro";

    toast("✅ Venda finalizada com sucesso!", "success");

  } catch (e) {
    console.error("Erro ao finalizar venda:", e);
    toast("Erro ao registrar venda. Tente novamente.", "error");
  } finally {
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg> Finalizar Venda`;
    btn.disabled = false;
  }
}

// ═══════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════
async function loadDashboard() {
  try {
    const dateStr = todayStr();
    const q = query(collection(db, "vendas"), where("dateStr", "==", dateStr));
    const snap = await getDocs(q);

    let totalVendas = 0;
    let totalLucro  = 0;
    const pagCount  = { dinheiro: 0, pix: 0, cartao: 0, fiado: 0 };
    const prodCount = {};

    for (const d of snap.docs) {
      const v = d.data();
      totalVendas += v.total || 0;
      totalLucro  += v.lucro  || 0;
      const pag = v.pagamento || "dinheiro";
      if (pagCount[pag] !== undefined) pagCount[pag]++;

      // Buscar itens para produtos mais vendidos
      const itensSnap = await getDocs(collection(db, "vendas", d.id, "itens"));
      itensSnap.forEach(iDoc => {
        const item = iDoc.data();
        prodCount[item.nome] = (prodCount[item.nome] || 0) + (item.qty || 1);
      });
    }

    document.getElementById("dash-total").textContent = fmt(totalVendas);
    document.getElementById("dash-lucro").textContent = fmt(totalLucro);
    document.getElementById("dash-qtd").textContent   = snap.size;

    renderChartPagamento(pagCount);
    renderChartProdutos(prodCount);

  } catch (e) {
    console.error("Erro ao carregar dashboard:", e);
  }
}

function renderChartPagamento(data) {
  const ctx = document.getElementById("chart-pagamento");
  if (chartPag) chartPag.destroy();

  chartPag = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Dinheiro", "Pix", "Cartão", "Fiado"],
      datasets: [{
        data: [data.dinheiro, data.pix, data.cartao, data.fiado],
        backgroundColor: ["#2e7d32","#1565c0","#7b1fa2","#e53935"],
        borderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom", labels: { font: { family: "DM Sans", size: 13 }, padding: 16 } }
      }
    }
  });
}

function renderChartProdutos(data) {
  const ctx = document.getElementById("chart-produtos");
  if (chartProd) chartProd.destroy();

  const sorted = Object.entries(data).sort((a,b) => b[1]-a[1]).slice(0,6);
  const labels = sorted.map(x => x[0]);
  const values = sorted.map(x => x[1]);

  chartProd = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Unidades vendidas",
        data: values,
        backgroundColor: "rgba(212,175,55,0.8)",
        borderColor: "#D4AF37",
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
        x: { ticks: { font: { family: "DM Sans", size: 12 } } }
      }
    }
  });
}

// ═══════════════════════════════════════════════
// RELATÓRIOS
// ═══════════════════════════════════════════════
function setupRelatorios() {
  const dateInput = document.getElementById("relatorio-date");
  dateInput.value = todayStr();
  dateInput.addEventListener("change", () => loadRelatorio(dateInput.value));
  document.getElementById("btn-exportar").addEventListener("click", exportarExcel);
  loadRelatorio(todayStr());
}

let vendasRelatorio = [];

async function loadRelatorio(dateStr) {
  const tbody = document.getElementById("relatorio-tbody");
  tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Carregando...</td></tr>`;

  try {
    const q = query(
      collection(db, "vendas"),
      where("dateStr", "==", dateStr),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);

    vendasRelatorio = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const total = vendasRelatorio.reduce((s,v) => s + (v.total||0), 0);
    const lucro = vendasRelatorio.reduce((s,v) => s + (v.lucro||0), 0);

    document.getElementById("rel-total").textContent = fmt(total);
    document.getElementById("rel-lucro").textContent = fmt(lucro);
    document.getElementById("rel-qtd").textContent   = vendasRelatorio.length;

    if (!vendasRelatorio.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Nenhuma venda nesta data.</td></tr>`;
      return;
    }

    tbody.innerHTML = vendasRelatorio.map(v => {
      const hora = v.createdAt?.toDate
        ? v.createdAt.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : "—";
      return `
        <tr>
          <td>${hora}</td>
          <td>${v.cliente || "—"}</td>
          <td><span class="pay-badge ${v.pagamento}">${v.pagamento}</span></td>
          <td><strong>${fmt(v.total)}</strong></td>
          <td>${v.desconto > 0 ? fmt(v.desconto) : "—"}</td>
          <td class="${v.lucro >= 0 ? 'green' : 'red'}">${fmt(v.lucro)}</td>
        </tr>
      `;
    }).join("");

  } catch (e) {
    console.error("Erro ao carregar relatório:", e);
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Erro ao carregar dados.</td></tr>`;
  }
}

// ═══════════════════════════════════════════════
// EXPORTAÇÃO EXCEL
// ═══════════════════════════════════════════════
async function exportarExcel() {
  if (!vendasRelatorio.length) {
    toast("Nenhuma venda para exportar.", "error");
    return;
  }

  const dateStr = document.getElementById("relatorio-date").value;

  const dados = vendasRelatorio.map(v => {
    const hora = v.createdAt?.toDate
      ? v.createdAt.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : "—";
    return {
      "Horário":         hora,
      "Cliente":         v.cliente || "—",
      "Forma Pagamento": v.pagamento,
      "Subtotal (R$)":   (v.subtotal || 0).toFixed(2),
      "Desconto (R$)":   (v.desconto || 0).toFixed(2),
      "Total (R$)":      (v.total || 0).toFixed(2),
      "Lucro (R$)":      (v.lucro || 0).toFixed(2),
    };
  });

  // Linha de totais
  dados.push({
    "Horário":         "TOTAL",
    "Cliente":         "",
    "Forma Pagamento": "",
    "Subtotal (R$)":   "",
    "Desconto (R$)":   "",
    "Total (R$)":      vendasRelatorio.reduce((s,v) => s+(v.total||0),0).toFixed(2),
    "Lucro (R$)":      vendasRelatorio.reduce((s,v) => s+(v.lucro||0),0).toFixed(2),
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(dados);

  // Largura das colunas
  ws["!cols"] = [
    { wch: 10 },{ wch: 22 },{ wch: 18 },
    { wch: 14 },{ wch: 14 },{ wch: 14 },{ wch: 14 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Vendas");
  XLSX.writeFile(wb, `elite_vendas_${dateStr}.xlsx`);
  toast("📊 Relatório exportado com sucesso!", "success");
}
