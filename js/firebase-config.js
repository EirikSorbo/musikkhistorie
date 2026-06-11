// ============================================================================
//  FIREBASE-KONFIGURASJON
// ----------------------------------------------------------------------------
//  Fyll inn verdiene du får når du oppretter et Firebase-prosjekt.
//  Se README.md for steg-for-steg-guide (tar ca. 5 minutter).
// ============================================================================

export const firebaseConfig = {
  apiKey: "AIzaSyAmV83wiZdNlLg70hmxNFLouWGgfTq_OF0",
  authDomain: "musikkhistorie-fb43d.firebaseapp.com",
  projectId: "musikkhistorie-fb43d",
  storageBucket: "musikkhistorie-fb43d.firebasestorage.app",
  messagingSenderId: "928123603712",
  appId: "1:928123603712:web:cd283499d4139bad7641e5",
};

// ----------------------------------------------------------------------------
//  LÆRER-TILGANG (Google-innlogging)
//  Google-kontoene som skal ha lærertilgang. Bare disse e-postadressene får
//  låse opp admin-funksjoner (veto, gjenopprett, slett, endre grenser).
//
//  Den SAMME listen må også settes i firestore.rules (funksjonen isTeacher),
//  for det er der den ekte sikkerheten ligger. Klientlisten styrer bare hva
//  som vises i grensesnittet.
// ----------------------------------------------------------------------------

export const TEACHER_EMAILS = [
  "eirik.sorbo@gmail.com",
];
