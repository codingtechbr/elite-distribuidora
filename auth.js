// ═══════════════════════════════════════════════
// auth.js — Autenticação Firebase
// Elite Distribuidora
// ═══════════════════════════════════════════════

import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Aguarda o DOM antes de registrar eventos
document.addEventListener("DOMContentLoaded", () => {
  const loginScreen = document.getElementById("login-screen");
  const appEl       = document.getElementById("app");
  const loginBtn    = document.getElementById("btn-login");
  const logoutBtn   = document.getElementById("btn-logout");
  const errorDiv    = document.getElementById("login-error");

  // ── Observa mudanças de autenticação ──────────────────
  onAuthStateChanged(auth, (user) => {
    if (user) {
      loginScreen.classList.add("hidden");
      appEl.classList.remove("hidden");
    } else {
      loginScreen.classList.remove("hidden");
      appEl.classList.add("hidden");
    }
  });

  // ── Login ──────────────────────────────────────────────
  loginBtn?.addEventListener("click", async () => {
    const email    = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-pass").value;

    if (!email || !password) {
      showError("Preencha e-mail e senha.");
      return;
    }

    loginBtn.textContent = "Entrando...";
    loginBtn.disabled    = true;
    errorDiv.classList.add("hidden");

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      loginBtn.innerHTML = `<span>Entrar</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>`;
      loginBtn.disabled = false;
      showError(translateError(err.code));
    }
  });

  // Permite pressionar Enter para logar
  document.getElementById("login-pass")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loginBtn.click();
  });

  // ── Logout ─────────────────────────────────────────────
  logoutBtn?.addEventListener("click", async () => {
    if (confirm("Deseja realmente sair do sistema?")) {
      await signOut(auth);
    }
  });

  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.classList.remove("hidden");
  }

  function translateError(code) {
    const errors = {
      "auth/invalid-email":      "E-mail inválido.",
      "auth/user-not-found":     "Usuário não encontrado.",
      "auth/wrong-password":     "Senha incorreta.",
      "auth/invalid-credential": "E-mail ou senha incorretos.",
      "auth/too-many-requests":  "Muitas tentativas. Aguarde alguns minutos.",
      "auth/network-request-failed": "Erro de rede. Verifique sua conexão."
    };
    return errors[code] || "Erro ao autenticar. Tente novamente.";
  }
});
