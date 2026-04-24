// ═══════════════════════════════════════════════
// firebase.js — Configuração do Firebase
// Elite Distribuidora
// ═══════════════════════════════════════════════
// INSTRUÇÕES:
// 1. Acesse console.firebase.google.com
// 2. Crie um projeto chamado "elite-distribuidora"
// 3. Ative o Firestore e o Authentication (Email/Senha)
// 4. Copie as configurações do seu projeto aqui abaixo
// ═══════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ⚠️  SUBSTITUA PELOS DADOS DO SEU PROJETO FIREBASE:
const firebaseConfig = {
  apiKey: "AIzaSyDaBysbMd7HLbX7HQsosjyd1FkpV5b8DF8",
  authDomain: "distribui-7028b.firebaseapp.com",
  projectId: "distribui-7028b",
  storageBucket: "distribui-7028b.firebasestorage.app",
  messagingSenderId: "280261379281",
  appId: "1:280261379281:web:9813761ce139ee72e5f1f0",
  measurementId: "G-XLR7HR06K8"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
